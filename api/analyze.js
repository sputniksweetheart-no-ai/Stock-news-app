export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST 요청만 사용할 수 있습니다."
    });
  }

  try {

    const {
      stock,
      title,
      description
    } = req.body || {};

    if (!title) {
      return res.status(400).json({
        error: "기사 제목이 없습니다."
      });
    }

    const safeStock =
      String(stock || "").slice(0, 100);

    const safeTitle =
      String(title || "").slice(0, 1000);

    const safeDescription =
      String(description || "").slice(0, 4000);


    /*
    ==========================================
    AI 분석 기준
    ==========================================
    */

    const prompt = `
너는 개인 투자자를 위한 뉴스 분석 도우미다.

아래에 제공된 기사 제목과 설명만을 바탕으로
"${safeStock}" 종목에 미칠 수 있는 영향을 분석하라.

[중요 원칙]

1. 기사 원문 전체를 읽었다고 가정하지 마라.

2. 제공된 정보에 없는 사실을 만들어내지 마라.

3. 정보가 부족하면 불확실하다고 판단하라.

4. 매수 또는 매도를 권유하지 마라.

5. 단순히 당일 주가가 올랐다는 이유만으로
   "긍정"이라고 판단하지 마라.

6. 단순히 당일 주가가 떨어졌다는 이유만으로
   "부정"이라고 판단하지 마라.

7. 가능하면 다음과 같은 기업의 펀더멘털을 중심으로 판단하라.

   - 매출
   - 이익
   - 비용
   - 수요
   - 공급
   - 시장점유율
   - 경쟁력
   - 기술력
   - 신규 사업
   - 규제
   - 고객
   - 투자
   - 생산능력

8. 거시경제 뉴스가 해당 기업에 미치는 연결고리가
   명확하지 않다면 중립 또는 불확실로 판단하라.


관심 종목:
${safeStock}

기사 제목:
${safeTitle}

기사 설명:
${safeDescription}


반드시 아래 JSON 형식으로만 답하라.

{
  "summary": [
    "첫 번째 핵심 요약",
    "두 번째 핵심 요약",
    "세 번째 핵심 요약"
  ],
  "impact": "긍정",
  "importance": 3,
  "reason": "해당 종목에 미칠 수 있는 영향을 설명"
}


impact는 반드시 다음 중 하나만 사용한다.

"긍정"
"부정"
"중립"
"불확실"


importance는 반드시 1부터 5까지의 정수다.

1 = 종목과 직접적인 관련성이 매우 낮음
2 = 참고할 만한 뉴스
3 = 투자자가 알아둘 필요가 있음
4 = 실적이나 사업에 의미 있는 뉴스
5 = 기업 가치에 큰 영향을 줄 수 있는 핵심 뉴스

summary는 정확히 3개 항목으로 작성한다.

reason은 2~3문장 정도로 간결하게 작성한다.
`;


    /*
    ==========================================
    Gemini 호출
    ==========================================
    */

    const geminiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      "gemini-3.5-flash-lite:generateContent";


    const geminiResponse =
      await fetch(
        geminiUrl,
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key":
              process.env.GEMINI_API_KEY
          },

          body: JSON.stringify({

            contents: [
              {
                parts: [
                  {
                    text: prompt
                  }
                ]
              }
            ],

            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: 700,
              responseMimeType:
                "application/json"
            }

          })
        }
      );


    const data =
      await geminiResponse.json();


    if (!geminiResponse.ok) {

      console.error(
        "Gemini API error:",
        data?.error?.message ||
        geminiResponse.status
      );

      return res.status(500).json({
        error:
          "Gemini AI 분석 요청에 실패했습니다."
      });
    }


    /*
    ==========================================
    Gemini 텍스트 추출
    ==========================================
    */

    const rawText =
      data?.candidates?.[0]
        ?.content
        ?.parts
        ?.map(function(part) {
          return part.text || "";
        })
        .join("")
        .trim();


    if (!rawText) {

      console.error(
        "Gemini returned no text."
      );

      return res.status(500).json({
        error:
          "AI 분석 결과가 비어 있습니다."
      });
    }


    /*
    ==========================================
    JSON 변환
    ==========================================
    */

    let analysis;

    try {

      let cleanText =
        rawText
          .replace(/^```json\s*/i, "")
          .replace(/^```\s*/i, "")
          .replace(/```$/i, "")
          .trim();

      analysis =
        JSON.parse(cleanText);

    } catch (parseError) {

      console.error(
        "Gemini JSON parse error"
      );

      return res.status(500).json({
        error:
          "AI 분석 결과를 정리하지 못했습니다."
      });
    }


    /*
    ==========================================
    결과 검증
    ==========================================
    */

    const validImpacts = [
      "긍정",
      "부정",
      "중립",
      "불확실"
    ];


    if (
      !Array.isArray(analysis.summary) ||
      analysis.summary.length !== 3
    ) {

      return res.status(500).json({
        error:
          "AI 요약 형식이 올바르지 않습니다."
      });
    }


    if (
      !validImpacts.includes(
        analysis.impact
      )
    ) {

      analysis.impact =
        "불확실";
    }


    let importance =
      Number(
        analysis.importance
      );


    if (
      !Number.isInteger(importance) ||
      importance < 1 ||
      importance > 5
    ) {

      importance = 1;
    }


    /*
    ==========================================
    안전한 최종 결과
    ==========================================
    */

    const safeAnalysis = {

      summary:
        analysis.summary
          .slice(0, 3)
          .map(function(item) {
            return String(item)
              .slice(0, 500);
          }),

      impact:
        analysis.impact,

      importance:
        importance,

      reason:
        String(
          analysis.reason || ""
        ).slice(0, 1500)

    };


    return res.status(200).json({
      analysis:
        safeAnalysis,

      provider:
        "gemini"
    });


  } catch (error) {

    console.error(
      "Analyze server error:",
      error.message
    );

    return res.status(500).json({
      error:
        "AI 분석 서버 오류"
    });

  }

}
