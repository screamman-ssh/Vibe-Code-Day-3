package score

import (
	"moneycircle/backend/internal/domain"
	"testing"
)

func TestGetTier(t *testing.T) {
	tests := []struct {
		score int
		tier  string
		th    string
	}{
		{85, "Thriving", "รุ่งเรือง"},
		{65, "Steady", "มั่นคง"},
		{45, "Building", "กำลังสร้าง"},
		{25, "At Risk", "เสี่ยง"},
	}

	for _, tc := range tests {
		tier, th := GetTier(tc.score)
		if tier != tc.tier || th != tc.th {
			t.Errorf("For score %d, expected %s (%s) but got %s (%s)", tc.score, tc.tier, tc.th, tier, th)
		}
	}
}

func TestCalculateScore_ColdStart(t *testing.T) {
	// A new user with no transaction/budget/debt history starts at 50 (Steady/Building)
	res := CalculateScore(nil, nil, nil, nil, 0.0, 0, "2026-06")

	// Dimensions should default to 50
	for _, d := range res.Dimensions {
		if d.Subscore != 50 {
			t.Errorf("Cold start: Expected dimension %s subscore to be 50, got %.1f", d.Key, d.Subscore)
		}
	}

	if res.TotalScore != 50 {
		t.Errorf("Expected cold start total score to be 50, got %d", res.TotalScore)
	}
}

func TestCalculateScore_BudgetAdherence(t *testing.T) {
	// 2 budget categories, 1 overspent, 1 within budget
	budgetCats := []*domain.BudgetCategory{
		{Category: "Food", LimitAmount: 1000},
		{Category: "Transport", LimitAmount: 500},
	}

	txs := []*domain.Transaction{
		{Type: "expense", Category: "Food", Amount: 800, Date: "2026-06-01"},
		{Type: "expense", Category: "Transport", Amount: 600, Date: "2026-06-02"}, // overspent!
	}

	res := CalculateScore(txs, budgetCats, nil, nil, 0.0, 0, "2026-06")

	// Budget adherence should be 50% (1 within out of 2 total)
	var budgetAdhSub float64
	for _, d := range res.Dimensions {
		if d.Key == "budgetAdherence" {
			budgetAdhSub = d.Subscore
		}
	}

	if budgetAdhSub != 50 {
		t.Errorf("Expected budgetAdherence subscore to be 50, got %.1f", budgetAdhSub)
	}
}

func TestCalculateScore_SavingsRate(t *testing.T) {
	// Income: 10,000, Expense: 8,000 (Savings rate = 20%) -> subscore should be 90
	txs := []*domain.Transaction{
		{Type: "income", Amount: 10000, Category: "Income", Date: "2026-06-01"},
		{Type: "expense", Amount: 8000, Category: "Food", Date: "2026-06-02"},
	}

	res := CalculateScore(txs, nil, nil, nil, 0.0, 0, "2026-06")

	var savingsSub float64
	for _, d := range res.Dimensions {
		if d.Key == "savingsRate" {
			savingsSub = d.Subscore
		}
	}

	if savingsSub != 90 {
		t.Errorf("Expected savingsRate subscore to be 90, got %.1f", savingsSub)
	}
}

func TestCalculateScore_EmergencyFund(t *testing.T) {
	// Emergency fund: 30,000, Average Monthly Expenses: 10,000 (3 months) -> subscore should be 85
	txs := []*domain.Transaction{
		{Type: "expense", Amount: 10000, Category: "Food", Date: "2026-06-01"},
	}

	res := CalculateScore(txs, nil, nil, nil, 30000.0, 0, "2026-06")

	var emgSub float64
	for _, d := range res.Dimensions {
		if d.Key == "emergencyFund" {
			emgSub = d.Subscore
		}
	}

	if emgSub != 85 {
		t.Errorf("Expected emergencyFund subscore to be 85, got %.1f", emgSub)
	}
}
