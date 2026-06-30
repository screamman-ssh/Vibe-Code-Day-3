package dto

import (
	"moneycircle/backend/internal/dto/social"
	"reflect"
	"strings"
	"testing"
)

func TestSocialDTOsPrivacy(t *testing.T) {
	forbiddenWords := []string{
		"amount", "balance", "income", "salary", "debt", "price", "cost",
	}

	structsToVerify := []interface{}{
		social.LeaderboardMemberDTO{},
		social.FeedEventDTO{},
		social.PublicScoreDTO{},
	}

	for _, str := range structsToVerify {
		typ := reflect.TypeOf(str)
		t.Run(typ.Name(), func(t *testing.T) {
			for i := 0; i < typ.NumField(); i++ {
				field := typ.Field(i)
				fieldNameLower := strings.ToLower(field.Name)
				jsonTagLower := strings.ToLower(field.Tag.Get("json"))

				for _, word := range forbiddenWords {
					if strings.Contains(fieldNameLower, word) {
						t.Errorf("Forbidden word '%s' found in struct field '%s.%s'", word, typ.Name(), field.Name)
					}
					if strings.Contains(jsonTagLower, word) {
						t.Errorf("Forbidden word '%s' found in JSON tag '%s' of field '%s.%s'", word, field.Tag.Get("json"), typ.Name(), field.Name)
					}
				}
			}
		})
	}
}
	
