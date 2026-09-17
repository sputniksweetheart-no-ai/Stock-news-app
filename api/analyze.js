export default async function handler(req, res) {

  /*
  ==========================================
  POST 요청만 허용
  ==========================================
  */

  if (req.method !== "POST") {

    return res.status(405).json({
      error: "POST 요청만 사용할 수 있습니다."
    });

  }


  try {

    /*
    ==========================================
    브라우저에서 받은 데이터
    ==========================================
    */

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


    /*
    ==========================================
    입력값 길이 제한
    ==========================================
    */

    const safeStock =
      String(stock || "")
        .slice(0, 100);


    const safeTitle =
      String(title || "")
        .slice(0, 1000);


    const safeDescription =
      String(description || "")
        .slice(0, 4000);



    /*
    ==========================================
    Gemini에게 줄 지시문
    ==========================================
    */

    const prompt = `
너는 개인 투자자를 위한 뉴스 분석 도우미다.

아래에 제공된 기사 제목과 설명만을 바탕으로 분석하라.

중요한 규칙:
- 제공되지 않은 사실을 만들어내지 마라.
- 기사 원문 전체를 읽었다고 가정하지 마라.
- 정보가 부족하면 "정보 부족"이라고 명시하라.
- 매수 또는 매도를 권유하지 마라.
- 과도하게 긍정적이거나 부정적으로 해석하지 마라.

관심 종목:
${safeStock}

기사 제목:
${safeTitle}

기사 설명:
${safeDescription}

반드시 다음 형식으로 한국어로 답하라.

[3줄 요약]
• 핵심 내용 1
• 핵심 내용 2
• 핵심 내용 3

[종목 영향]
긍정 / 부정 / 중립 / 불확실 중 하나

[이유]
해당 뉴스가 ${safeStock}에 어떤 의미가 있을 수 있는지
2~3문장으로 설명하라.

[중요도]
1~5 중 숫자 하나

중요도 기준:
1 = 종목과 관련성이 매우 낮음
2 = 참고할 만함
3 = 투자자가 알아둘 필요가 있음
4 = 실적이나 사업에 의미 있는 뉴스
5 = 기업 가치에 큰 영향을 줄 수 있는 핵심 뉴스
`;



    /*
    ==========================================
    Gemini API 호출
    ==========================================
    */

    const geminiUrl =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      "gemini-2.5-flash-lite:generateContent";


    const geminiResponse =
      await fetch(
        geminiUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

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

              maxOutputTokens: 600

            }

          })
        }
      );



    /*
    ==========================================
    Gemini 응답 읽기
    ==========================================
    */

    const data =
      await geminiResponse.json();



    /*
    ==========================================
    Gemini 오류 처리
    ==========================================
    */

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
    Gemini가 생성한 텍스트 꺼내기
    ==========================================
    */

    const analysis =
      data?.candidates?.[0]
        ?.content
        ?.parts
        ?.map(
          function(part) {

            return part.text || "";

          }
        )
        .join("")
        .trim();



    /*
    ==========================================
    결과가 비어 있는 경우
    ==========================================
    */

    if (!analysis) {

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
    브라우저에 분석 결과 전달
    ==========================================
    */

    return res.status(200).json({

      analysis: analysis,

      provider: "gemini"

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
