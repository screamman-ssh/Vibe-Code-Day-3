package service

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"moneycircle/internal/config"
	"moneycircle/internal/dto/private"
	"net/http"
	"time"
)

type LLMService struct {
	cfg        *config.Config
	billingSvc *BillingService
}

func NewLLMService(cfg *config.Config, billingSvc *BillingService) *LLMService {
	return &LLMService{
		cfg:        cfg,
		billingSvc: billingSvc,
	}
}

type OCRResult struct {
	Merchant   string  `json:"merchant"`
	Amount     float64 `json:"amount"`
	Date       string  `json:"date"`
	Category   string  `json:"category"`
	Confidence float64 `json:"confidence"`
}

func (s *LLMService) OCRReceipt(userID string, imageBytes []byte, mimeType string) (*OCRResult, error) {
	// 1. Quota check
	ok, err := s.billingSvc.CheckOCRQuota(userID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, errors.New("QUOTA_EXCEEDED")
	}

	reqID := fmt.Sprintf("ocr-%d", time.Now().UnixNano())
	var ocrRes OCRResult
	var tokensEstimated int

	// 2. Perform OCR (Real API call or Mock fallback)
	if s.cfg.LLMAPIKey == "" || s.cfg.LLMAPIKey == "mock" {
		// Mock response
		log.Printf("[LLM Mock] Processing OCR for user %s", userID)
		time.Sleep(1 * time.Second) // simulate network delay
		ocrRes = OCRResult{
			Merchant:   "7-Eleven",
			Amount:     89.0,
			Date:       time.Now().Format("2006-01-02"),
			Category:   "Food",
			Confidence: 0.95,
		}
		tokensEstimated = 500
	} else {
		// Prepare base64 image
		base64Img := base64.StdEncoding.EncodeToString(imageBytes)
		dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64Img)

		payload := map[string]interface{}{
			"model": s.cfg.LLMModel,
			"messages": []map[string]interface{}{
				{
					"role": "system",
					"content": "You are a specialized receipt scanner. Your task is to analyze receipt images and output structured financial transaction data. Return ONLY JSON format.",
				},
				{
					"role": "user",
					"content": []map[string]interface{}{
						{
							"type": "text",
							"text": "Extract details from this Thai receipt. Return ONLY a JSON object with keys: merchant (string), amount (number, float), date (string in YYYY-MM-DD format), category (string: Food, Transport, Housing, Utilities, Entertainment, Health, Education, Debt Payment, Savings, or Other), and confidence (number, float between 0.0 and 1.0). If you cannot find a date, use today's date (" + time.Now().Format("2006-01-02") + "). Do not include any markdown fences or extra explanations, output raw JSON.",
						},
						{
							"type": "image_url",
							"image_url": map[string]interface{}{
								"url": dataURL,
							},
						},
					},
				},
			},
			"response_format": map[string]string{"type": "json_object"},
			"temperature":     0.1,
		}

		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}

		apiRes, err := s.callWithRetry(s.cfg.LLMBaseURL+"/chat/completions", bodyBytes)
		if err != nil {
			return nil, err
		}

		var oaiResp struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
			Usage struct {
				TotalTokens int `json:"total_tokens"`
			} `json:"usage"`
		}

		if err := json.Unmarshal(apiRes, &oaiResp); err != nil {
			return nil, err
		}

		if len(oaiResp.Choices) == 0 {
			return nil, errors.New("empty response from LLM")
		}

		content := oaiResp.Choices[0].Message.Content
		if err := json.Unmarshal([]byte(content), &ocrRes); err != nil {
			return nil, fmt.Errorf("failed to parse structured JSON from LLM: %w. Content: %s", err, content)
		}

		tokensEstimated = oaiResp.Usage.TotalTokens
	}

	// 3. Log usage
	_ = s.billingSvc.LogUsage(userID, "ocr", tokensEstimated, reqID)

	return &ocrRes, nil
}

func (s *LLMService) GenerateCoach(userID string, scoreVal int, tier, tierTh string, dims []private.ScoreDimensionDTO) (string, error) {
	// Premium Check
	if err := s.billingSvc.RequirePremium(userID); err != nil {
		return "", err
	}

	reqID := fmt.Sprintf("coach-%d", time.Now().UnixNano())
	var responseText string
	var tokensEstimated int

	// Compile metrics description
	metricsSummary := fmt.Sprintf("Score: %d, Tier: %s (%s)\n", scoreVal, tier, tierTh)
	for _, d := range dims {
		metricsSummary += fmt.Sprintf("- %s (Weight %d%%): Subscore %.1f\n", d.Label, int(d.Weight*100), d.Subscore)
	}

	if s.cfg.LLMAPIKey == "" || s.cfg.LLMAPIKey == "mock" {
		time.Sleep(1 * time.Second)
		responseText = "คำแนะนำจากโค้ช AI สำหรับวันนี้:\n" +
			"1. ยอดเยี่ยมมากที่คุณสามารถคุมรายจ่ายในหมวดอาหารไม่ให้เกินงบประหยัดที่ตั้งไว้ได้ แนะนำให้รักษาวินัยแบบนี้ต่อไป\n" +
			"2. อัตราการออมเงินในเดือนนี้อยู่ที่ 8% ซึ่งถือว่าเป็นจุดเริ่มต้นที่ดี แต่หากปรับลดค่าหมวดบันเทิงลงอีกนิด จะช่วยยกระดับให้ถึงเป้าหมาย 10% ได้ง่ายขึ้น\n" +
			"3. สุขภาพหนี้ของคุณมีความก้าวหน้าที่น่าสนใจ แนะนำให้พิจารณาใช้สูตรชำระหนี้แบบ Snowball เพื่อลดดอกเบี้ยสะสมโดยรวมของหนี้บัตรเครดิตที่มี APR สูงสุด\n\n" +
			"*หมายเหตุ: ข้อแนะนำนี้เป็นข้อมูลเพื่อการศึกษาทางการเงินเท่านั้น ไม่ใช่คำแนะนำทางการเงินที่ได้รับใบอนุญาต*"
		tokensEstimated = 300
	} else {
		payload := map[string]interface{}{
			"model": s.cfg.LLMModel,
			"messages": []map[string]interface{}{
				{
					"role":    "system",
					"content": "You are a professional personal finance coach for young adults in Thailand. Your advice is encouraging, educational, and actionable. You MUST speak in natural Thai language. Add the legal disclaimer: 'ไม่ใช่คำแนะนำทางการเงินที่ได้รับใบอนุญาต' at the very bottom.",
				},
				{
					"role":    "user",
					"content": "Here are my current financial health dimensions:\n" + metricsSummary + "\nGive me exactly 3 short, specific, and actionable coaching tips in Thai based on these scores.",
				},
			},
			"temperature": 0.7,
		}

		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return "", err
		}

		apiRes, err := s.callWithRetry(s.cfg.LLMBaseURL+"/chat/completions", bodyBytes)
		if err != nil {
			return "", err
		}

		var oaiResp struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
			Usage struct {
				TotalTokens int `json:"total_tokens"`
			} `json:"usage"`
		}

		if err := json.Unmarshal(apiRes, &oaiResp); err != nil {
			return "", err
		}

		if len(oaiResp.Choices) == 0 {
			return "", errors.New("empty response from LLM")
		}

		responseText = oaiResp.Choices[0].Message.Content
		tokensEstimated = oaiResp.Usage.TotalTokens
	}

	_ = s.billingSvc.LogUsage(userID, "coach", tokensEstimated, reqID)

	return responseText, nil
}

func (s *LLMService) GenerateAnalysis(userID string, scoreVal int, tier string, txs []*domain.Transaction, debts []*domain.Debt) (string, error) {
	// Premium Check
	if err := s.billingSvc.RequirePremium(userID); err != nil {
		return "", err
	}

	reqID := fmt.Sprintf("analyze-%d", time.Now().UnixNano())
	var responseText string
	var tokensEstimated int

	if s.cfg.LLMAPIKey == "" || s.cfg.LLMAPIKey == "mock" {
		time.Sleep(2 * time.Second)
		responseText = "# รายงานวิเคราะห์สถานะทางการเงินเชิงลึก\n\n" +
			"## 1. แนวโน้มและการใช้จ่าย (Trends & Categories)\n" +
			"- จากการบันทึกรายการล่าสุด คุณมีสัดส่วนรายจ่ายในหมวด **อาหาร (Food)** สูงสุด คิดเป็น 42% ของรายจ่ายทั้งหมด\n" +
			"- แนวโน้มการออมเฉลี่ยคงที่ แต่ยังมีพื้นที่เพิ่มการออมได้อีก หากบริหารจัดการหมวด **ความบันเทิง (Entertainment)**\n\n" +
			"## 2. โครงสร้างสุขภาพหนี้ (Debt Projections)\n" +
			"- คุณมีภาระหนี้ทั้งหมดที่บันทึกไว้ 2 รายการ ดอกเบี้ยสูงสุดอยู่ที่ 16% APR\n" +
			"- หากชำระตามยอดขั้นต่ำเดิม จะใช้เวลาประมาณ 18 เดือนในการปลดหนี้ แต่ถ้าชำระเพิ่มขึ้นเดือนละ 1,000 บาท จะสามารถย่นระยะเวลาลงเหลือ 11 เดือน และประหยัดค่าดอกเบี้ยได้ 3,400 บาท\n\n" +
			"## 3. แผนสุขภาพการเงินที่แนะนำ\n" +
			"- **เพิ่มสภาพคล่อง:** รักษากองทุนฉุกเฉินให้ได้ 1 เท่าของค่าใช้จ่ายรายเดือนก่อนในขั้นแรก\n" +
			"- **จัดกลุ่มงบประมาณ:** ล็อคเป้างบหมวดช็อปปิ้งไว้ไม่เกิน 15% ของรายได้\n\n" +
			"---\n" +
			"*หมายเหตุ: ข้อแนะนำนี้จัดทำขึ้นโดยระบบอัตโนมัติเพื่อการวิเคราะห์ทางวิชาการและทักษะการบริหารเงินส่วนบุคคล ไม่ใช่คำแนะนำทางการเงินที่ได้รับใบอนุญาต*"
		tokensEstimated = 450
	} else {
		// Compile transactions and debts to format context
		txSummary := ""
		for i, t := range txs {
			if i > 50 {
				break // limit summary scope
			}
			txSummary += fmt.Sprintf("- %s: %s ฿%.1f (%s)\n", t.Date, t.Type, t.Amount, t.Category)
		}

		debtSummary := ""
		for _, d := range debts {
			debtSummary += fmt.Sprintf("- %s: Balance ฿%.1f, APR %.1f%%, MinPay ฿%.1f\n", d.Name, d.Balance, d.APR, d.MinimumPayment)
		}

		prompt := fmt.Sprintf("My general info:\nScore: %d, Tier: %s\n\nMy active debts:\n%s\n\nMy transaction logs (latest):\n%s\n\nProduce an in-depth financial analysis report in Thai language using Markdown. Divide it into sections: 'แนวโน้มการใช้จ่าย', 'การประมาณการและแผนชำระหนี้', and 'แผนปฏิบัติการเพื่ออัพเกรดคะแนน'. Keep it professional and append the license disclaimer at the bottom.", scoreVal, tier, debtSummary, txSummary)

		payload := map[string]interface{}{
			"model": s.cfg.LLMModel,
			"messages": []map[string]interface{}{
				{
					"role":    "system",
					"content": "You are a professional financial advisor. Analyze the transaction history and debt structures provided to yield a detailed markdown analysis in Thai. Maintain a positive, professional educational tone.",
				},
				{
					"role":    "user",
					"content": prompt,
				},
			},
			"temperature": 0.5,
		}

		bodyBytes, err := json.Marshal(payload)
		if err != nil {
			return "", err
		}

		apiRes, err := s.callWithRetry(s.cfg.LLMBaseURL+"/chat/completions", bodyBytes)
		if err != nil {
			return "", err
		}

		var oaiResp struct {
			Choices []struct {
				Message struct {
					Content string `json:"content"`
				} `json:"message"`
			} `json:"choices"`
			Usage struct {
				TotalTokens int `json:"total_tokens"`
			} `json:"usage"`
		}

		if err := json.Unmarshal(apiRes, &oaiResp); err != nil {
			return "", err
		}

		if len(oaiResp.Choices) == 0 {
			return "", errors.New("empty response from LLM")
		}

		responseText = oaiResp.Choices[0].Message.Content
		tokensEstimated = oaiResp.Usage.TotalTokens
	}

	_ = s.billingSvc.LogUsage(userID, "analyze", tokensEstimated, reqID)

	return responseText, nil
}

func (s *LLMService) callWithRetry(url string, body []byte) ([]byte, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	var lastErr error
	for attempt := 0; attempt <= 1; attempt++ {
		if attempt > 0 {
			log.Printf("[LLM Client] Upstream 5xx. Retrying in 1s...")
			time.Sleep(1 * time.Second)
		}

		req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
		if err != nil {
			return nil, err
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+s.cfg.LLMAPIKey)

		resp, err := client.Do(req)
		if err != nil {
			lastErr = err
			continue
		}
		defer resp.Body.Close()

		respBody, err := io.ReadAll(resp.Body)
		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode >= 500 {
			lastErr = fmt.Errorf("upstream returned status %d: %s", resp.StatusCode, string(respBody))
			continue
		}

		if resp.StatusCode != http.StatusOK {
			return nil, fmt.Errorf("upstream error status %d: %s", resp.StatusCode, string(respBody))
		}

		return respBody, nil
	}

	return nil, fmt.Errorf("request failed after retries: %w", lastErr)
}
