package score

import (
	"math"
	"moneycircle/backend/internal/domain"
	"moneycircle/backend/internal/dto/private"
	"strings"
)

var Weights = map[string]float64{
	"budgetAdherence":   0.25,
	"savingsRate":       0.20,
	"debtHealth":        0.25,
	"emergencyFund":     0.15,
	"consistencyStreak": 0.15,
}

func GetTier(totalScore int) (string, string) {
	if totalScore >= 80 {
		return "Thriving", "รุ่งเรือง"
	} else if totalScore >= 60 {
		return "Steady", "มั่นคง"
	} else if totalScore >= 40 {
		return "Building", "กำลังสร้าง"
	}
	return "At Risk", "เสี่ยง"
}

func savingsRateSubscore(rate float64) float64 {
	if rate <= 0 {
		return 0
	}
	if rate <= 5 {
		return 40
	}
	if rate <= 10 {
		return 70
	}
	if rate <= 20 {
		return 90
	}
	return 100
}

func emergencyFundSubscore(months float64) float64 {
	if months <= 0 {
		return 0
	}
	if months < 1 {
		return 30
	}
	if months <= 2 {
		return 60
	}
	if months <= 5 {
		return 85
	}
	return 100
}

func streakSubscore(days int) float64 {
	if days <= 0 {
		return 0
	}
	if days <= 3 {
		return 30
	}
	if days <= 7 {
		return 60
	}
	if days <= 14 {
		return 80
	}
	return 100
}

func dtiSubscore(dti float64) float64 {
	if dti <= 0 {
		return 100
	}
	if dti <= 15 {
		return 90
	}
	if dti <= 30 {
		return 70
	}
	if dti <= 45 {
		return 40
	}
	return 10
}

func computeBudgetAdherence(budgetCategories []*domain.BudgetCategory, transactions []*domain.Transaction, month string) float64 {
	if len(budgetCategories) == 0 {
		return 50
	}

	var expenses []*domain.Transaction
	for _, t := range transactions {
		if t.Type == "expense" && strings.HasPrefix(t.Date, month) {
			expenses = append(expenses, t)
		}
	}

	var within int
	var total int
	for _, cat := range budgetCategories {
		if cat.LimitAmount <= 0 {
			continue
		}
		total++

		var spent float64
		for _, e := range expenses {
			if e.Category == cat.Category {
				spent += e.Amount
			}
		}

		if spent <= cat.LimitAmount {
			within++
		}
	}

	if total == 0 {
		return 50
	}

	return math.Round((float64(within) / float64(total)) * 100)
}

func computeSavingsRate(transactions []*domain.Transaction, month string) float64 {
	var income, expense float64
	for _, t := range transactions {
		if strings.HasPrefix(t.Date, month) {
			if t.Type == "income" {
				income += t.Amount
			} else if t.Type == "expense" {
				expense += t.Amount
			}
		}
	}

	if income <= 0 {
		return 50
	}

	rate := ((income - expense) / income) * 100
	return savingsRateSubscore(rate)
}

func computeDebtHealth(debts []*domain.Debt, debtPayments map[string][]*domain.DebtPayment, transactions []*domain.Transaction, month string) float64 {
	if len(debts) == 0 {
		return 50
	}

	var income float64
	var debtPaymentsTx float64

	for _, t := range transactions {
		if strings.HasPrefix(t.Date, month) {
			if t.Type == "income" {
				income += t.Amount
			}
			if t.Category == "Debt Payment" {
				debtPaymentsTx += t.Amount
			}
		}
	}

	dti := 0.0
	if income > 0 {
		dti = (debtPaymentsTx / income) * 100
	}
	dtiScore := dtiSubscore(dti)

	var maxOnTimeStreak int
	for _, d := range debts {
		payments := debtPayments[d.ID]
		// Calculate streak of consecutive on_time == true
		// Note payments are assumed to be sorted by paid_at descending
		currentStreak := 0
		for _, p := range payments {
			if p.OnTime {
				currentStreak++
			} else {
				break
			}
		}
		if currentStreak > maxOnTimeStreak {
			maxOnTimeStreak = currentStreak
		}
	}

	streakScore := math.Min(100, float64(maxOnTimeStreak*20))
	return math.Round(dtiScore*0.5 + streakScore*0.5)
}

func computeEmergencyFund(emergencyFundAmount float64, avgMonthlyExpenses float64) float64 {
	if avgMonthlyExpenses <= 0 {
		return 50
	}
	months := emergencyFundAmount / avgMonthlyExpenses
	return emergencyFundSubscore(months)
}

type ScoreResult struct {
	TotalScore int
	Tier       string
	TierTh     string
	Dimensions []private.ScoreDimensionDTO
}

func CalculateScore(
	transactions []*domain.Transaction,
	budgetCategories []*domain.BudgetCategory,
	debts []*domain.Debt,
	debtPayments map[string][]*domain.DebtPayment,
	emergencyFundAmount float64,
	loggingStreakDays int,
	month string,
) *ScoreResult {

	// Average monthly expenses is the current month's expenses, or 15000 if 0
	var currentMonthExpenses float64
	for _, t := range transactions {
		if t.Type == "expense" && strings.HasPrefix(t.Date, month) {
			currentMonthExpenses += t.Amount
		}
	}

	avgExpenses := currentMonthExpenses
	if avgExpenses <= 0 {
		avgExpenses = 15000
	}

	dims := []private.ScoreDimensionDTO{
		{
			Key:      "budgetAdherence",
			Label:    "การทำตามงบประมาณ",
			Weight:   Weights["budgetAdherence"],
			Subscore: computeBudgetAdherence(budgetCategories, transactions, month),
		},
		{
			Key:      "savingsRate",
			Label:    "อัตราการออม",
			Weight:   Weights["savingsRate"],
			Subscore: computeSavingsRate(transactions, month),
		},
		{
			Key:      "debtHealth",
			Label:    "สุขภาพหนี้",
			Weight:   Weights["debtHealth"],
			Subscore: computeDebtHealth(debts, debtPayments, transactions, month),
		},
		{
			Key:      "emergencyFund",
			Label:    "กองทุนฉุกเฉิน",
			Weight:   Weights["emergencyFund"],
			Subscore: computeEmergencyFund(emergencyFundAmount, avgExpenses),
		},
		{
			Key:      "consistencyStreak",
			Label:    "ความสม่ำเสมอ",
			Weight:   Weights["consistencyStreak"],
			Subscore: streakSubscore(loggingStreakDays),
		},
	}

	var weightedSum float64
	for _, d := range dims {
		weightedSum += d.Subscore * d.Weight
	}

	totalScore := int(math.Round(weightedSum))
	tier, tierTh := GetTier(totalScore)

	return &ScoreResult{
		TotalScore: totalScore,
		Tier:       tier,
		TierTh:     tierTh,
		Dimensions: dims,
	}
}
