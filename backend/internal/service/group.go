package service

import (
	"crypto/rand"
	"errors"
	"moneycircle/internal/domain"
	"moneycircle/internal/dto/social"
	"moneycircle/internal/repository"
	"sort"
	"time"

	"github.com/google/uuid"
)

type GroupService struct {
	repo *repository.Repository
}

func NewGroupService(repo *repository.Repository) *GroupService {
	return &GroupService{repo: repo}
}

func (s *GroupService) CreateGroup(userID, name string) (*domain.Group, error) {
	// Enforce: one group per user. Check if user already in a group.
	existing, err := s.repo.GetGroupByUserID(userID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errors.New("ALREADY_IN_GROUP")
	}

	inviteCode := generateInviteCode()
	g := &domain.Group{
		ID:         uuid.New().String(),
		Name:       name,
		InviteCode: inviteCode,
		OwnerID:    userID,
		MaxMembers: 15,
		CreatedAt:  time.Now(),
	}

	if err := s.repo.CreateGroup(g); err != nil {
		return nil, err
	}

	// Update user's onboardingComplete flag
	user, err := s.repo.GetUserByID(userID)
	if err == nil && user != nil {
		user.OnboardingComplete = true
		_ = s.repo.UpdateUser(user)
	}

	return g, nil
}

func (s *GroupService) JoinGroup(userID, inviteCode string) (*domain.Group, error) {
	// Enforce: one group per user. Check if user already in a group.
	existing, err := s.repo.GetGroupByUserID(userID)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return nil, errors.New("ALREADY_IN_GROUP")
	}

	g, err := s.repo.GetGroupByInviteCode(inviteCode)
	if err != nil {
		return nil, err
	}
	if g == nil {
		return nil, errors.New("INVALID_INVITE_CODE")
	}

	// Enforce max 15 members
	count, err := s.repo.GetGroupMembersCount(g.ID)
	if err != nil {
		return nil, err
	}
	if count >= g.MaxMembers {
		return nil, errors.New("GROUP_FULL")
	}

	if err := s.repo.AddGroupMember(g.ID, userID); err != nil {
		return nil, err
	}

	// Update user's onboardingComplete flag
	user, err := s.repo.GetUserByID(userID)
	if err == nil && user != nil {
		user.OnboardingComplete = true
		_ = s.repo.UpdateUser(user)
	}

	return g, nil
}

func (s *GroupService) LeaveGroup(userID string) error {
	g, err := s.repo.GetGroupByUserID(userID)
	if err != nil {
		return err
	}
	if g == nil {
		return errors.New("NOT_IN_GROUP")
	}

	// If owner, check if there are other members. If yes, prevent leaving without transferring ownership
	// For simplicity in MVP, if owner leaves and is last, we delete group.
	// Otherwise, we delete the group member row.
	if g.OwnerID == userID {
		count, err := s.repo.GetGroupMembersCount(g.ID)
		if err != nil {
			return err
		}
		if count > 1 {
			return errors.New("OWNER_CANNOT_LEAVE_GROUP_WITH_MEMBERS")
		}
		// Delete group members and group
		_ = s.repo.RemoveGroupMember(g.ID, userID)
		// We can let delete cascade or delete group row
		_, _ = s.repo.RawExec("DELETE FROM groups WHERE id = $1", g.ID)
		return nil
	}

	return s.repo.RemoveGroupMember(g.ID, userID)
}

func (s *GroupService) RemoveMember(ownerID, groupID, userIDToRemove string) error {
	g, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return err
	}
	if g == nil {
		return errors.New("GROUP_NOT_FOUND")
	}
	if g.OwnerID != ownerID {
		return errors.New("UNAUTHORIZED_NOT_OWNER")
	}

	if g.OwnerID == userIDToRemove {
		return errors.New("OWNER_CANNOT_BE_REMOVED")
	}

	return s.repo.RemoveGroupMember(groupID, userIDToRemove)
}

func (s *GroupService) RegenerateInviteCode(ownerID, groupID string) (string, error) {
	g, err := s.repo.GetGroupByID(groupID)
	if err != nil {
		return "", err
	}
	if g == nil {
		return "", errors.New("GROUP_NOT_FOUND")
	}
	if g.OwnerID != ownerID {
		return "", errors.New("UNAUTHORIZED_NOT_OWNER")
	}

	newCode := generateInviteCode()
	if err := s.repo.UpdateGroupInviteCode(groupID, newCode); err != nil {
		return "", err
	}
	return newCode, nil
}

func (s *GroupService) GetLeaderboard(userID, groupID string) ([]social.LeaderboardMemberDTO, error) {
	// Membership check
	isMember, err := s.repo.IsGroupMember(groupID, userID)
	if err != nil {
		return nil, err
	}
	if !isMember {
		return nil, errors.New("UNAUTHORIZED_NOT_MEMBER")
	}

	users, members, err := s.repo.GetGroupMembers(groupID)
	if err != nil {
		return nil, err
	}

	var list []social.LeaderboardMemberDTO

	for i, u := range users {
		gm := members[i]

		// Fetch latest score snapshot
		latestScore, err := s.repo.GetLatestScoreSnapshot(u.ID)
		scoreVal := 50
		tier := "Building"
		tierTh := "กำลังสร้าง"

		if err == nil && latestScore != nil {
			scoreVal = latestScore.TotalScore
			tier = latestScore.Tier
			tierTh = latestScore.TierTh
		}

		// Fetch badges
		badges, _ := s.repo.GetUserBadges(u.ID)

		list = append(list, social.LeaderboardMemberDTO{
			DisplayName: u.DisplayName,
			AvatarURL:   u.AvatarURL,
			Score:       scoreVal,
			Tier:        tier,
			TierTh:      tierTh,
			Badges:      badges,
			StreakDays:  u.LoggingStreakDays,
			HideRank:    gm.HideRank,
		})
	}

	// Sort by score descending
	sort.Slice(list, func(i, j int) bool {
		return list[i].Score > list[j].Score
	})

	// Assign ranks
	for i := range list {
		rank := i + 1
		if !list[i].HideRank {
			list[i].Rank = &rank
		} else {
			list[i].Rank = nil
		}
	}

	return list, nil
}

func generateInviteCode() string {
	const charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 6)
	_, _ = rand.Read(b)
	for i := range b {
		b[i] = charset[int(b[i])%len(charset)]
	}
	return string(b)
}
