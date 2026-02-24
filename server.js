import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3500;

app.use(express.json({ limit: "1mb" }));

app.use(
  cors({
    origin: ["http://localhost:5173", "https://soulvage.github.io/"]
  })
);

// Helper: Safe JSON Parse
function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

app.post("/chatbot", async (req, res) => {
  try {
    const { answers } = req.body;

    if (!answers) {
      return res.status(400).json({
        error: "answers field is required",
      });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5173",
          "X-Title": "Personality Analyzer",
        },
        body: JSON.stringify({
          model: "openai/gpt-4o-mini",
          temperature: 0.3,
          response_format: { type: "json_object" }, // کمک می‌کند مدل JSON تمیز بدهد
          messages: [
            {
              role: "system",
              content: `
شما یک AI حرفه‌ای تحلیل شخصیت هستید.

وظیفه شما:
با توجه به پاسخ‌های کاربر به سوالات روانشناسی و رفتاری، یک گزارش شخصیت کامل، روانشناختی و واقع‌گرایانه ایجاد کنید.

قوانین مهم:

1. پاسخ شما باید **تنها یک آرایه JSON معتبر** باشد.
2. هیچ متن، توضیح یا markdown اضافه‌ای ننویسید.
3. تمام متن‌ها باید **به زبان فارسی** باشند.
4. مقادیر عددی (scores) باید بین 0 تا 100 باشند.
5. پاسخ باید بر اساس **تن صدا، زبان احساسی، اعتماد به نفس، نشانه‌های استرس و مقاومت روانی** ارزیابی شود.
6. هرگونه تحلیل، توضیح یا نتیجه‌گیری باید در داخل JSON و در فیلدهای مشخص باشد.
7. ساختار JSON باید دقیقاً به شکل زیر باشد و **یک آرایه با یک شیء داخل آن** برگردانده شود.

فرمت JSON:

[
  {
    "title": "string (عنوان شخصیت فارسی)",
    "summary": "string (توضیح انگیزشی فارسی درباره شخصیت)",

    "personalityRadar": {
      "emotionalStability": number (0-100),
      "stressManagement": number (0-100),
      "socialConfidence": number (0-100),
      "motivation": number (0-100),
      "resilience": number (0-100)
    },

    "emotionalTrendSummary": {
      "positiveIndicators": number,
      "stressIndicators": number,
      "analysis": "string (تحلیل احساسی فارسی)"
    },

    "recommendations": {
      "areasToImprove": [
        "string (نکته قابل بهبود)",
        "string",
        "string"
      ],
      "strengthsToMaintain": [
        "string (نقاط قوت که باید حفظ شود)",
        "string",
        "string"
      ]
    },

    "dailyHabits": [
      "string (عادت روزانه)",
      "string",
      "string",
      "string"
    ],

    "stressManagementTips": [
      "string (تکنیک مدیریت استرس)",
      "string",
      "string",
      "string"
    ]
  }
]

امتیازدهی:

- زبان با اعتماد به نفس → socialConfidence بالاتر
- اشاره به بازیابی از شکست → resilience بالاتر
- ذکر نگرانی و اضطراب زیاد → stressManagement پایین‌تر
- نگرش هدف‌محور → motivation بالاتر
- پردازش آرام احساسات → emotionalStability بالاتر

تمام خروجی باید روانشناختی، واقعی و **داخلیاً منسجم** باشد.

Return **ONLY the JSON array**.
`,
            },
            {
              role: "user",
              content: JSON.stringify(answers),
            },
          ],
        }),
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json({
        error: "OpenRouter API Error",
        details: errorText,
      });
    }

    const data = await response.json();

    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      return res.status(500).json({
        error: "Invalid AI response",
      });
    }

    const parsed = safeJsonParse(content);

    if (!parsed) {
      return res.status(500).json({
        error: "AI did not return valid JSON",
        raw: content,
      });
    }
    console.log(parsed);
    return res.status(200).json(parsed);
  } catch (err) {
    if (err.name === "AbortError") {
      return res.status(408).json({
        error: "Request timeout",
      });
    }

    return res.status(500).json({
      error: "Server error",
      message: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
