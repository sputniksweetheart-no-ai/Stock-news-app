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
    브라우저에서 받은 기사 정보
    ==========================================
    */

    const {
      stock,
      title,
      description
    } = req.body || {};


    /*
      최소한 제목은 있어야 분석 가능
    */

    if (!title) {

      return res.status(400).json({
        error: "기사 제목이 없습니다."
      });

    }


    /*
    ==========================================
    입력 길이 제한

    외부 뉴스 데이터가 지나치게 길거나
    이상한 경우를 대비한다.
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
    AI에게 줄 지시문
    ==========================================
    */

    const prompt = `
너는 개인 투자자를 돕는 뉴스 분석 도우미다.

아래 뉴스 정보만을 바탕으로 분석하라.

확인할 수 없는 사실을 만들어내지 말고,
정보가 부족하면 정보가 부족하다고 명시하라.

매수 또는 매도를 권유하지 마라.

관심 종목:
${safeStock}

기사 제목:
${safeTitle}

기사 설명:
${safeDescription}

다음 형식으로 한국어로 답하라.

[3줄 요약]
• 핵심 내용 1
• 핵심 내용 2
• 핵심 내용 3

[종목 영향]
긍정 / 부정 / 중립 / 불확실 중 하나

[이유]
투자 관점에서 왜 그런 영향을 줄 수 있는지
2~3문장으로 설명

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
    OpenAI Responses API 호출

    API Key는 Vercel 환경변수에서만 읽는다.
    브라우저로 보내지 않는다.
    ==========================================
    */

    const openAIResponse =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",

            "Authorization":
              "Bearer " +
              process.env.OPENAI_API_KEY
          },

          body: JSON.stringify({

            model:
              "gpt-5-mini",

            input:
              prompt,

            max_output_tokens:
              600

          })
        }
      );



    /*
    ==========================================
    OpenAI 응답 읽기
    ==========================================
    */

    const data =
      await openAIResponse.json();



    /*
      OpenAI에서 오류가 발생한 경우

      API Key 자체는 절대 브라우저로 보내지 않는다.
    */

    if (!openAIResponse.ok) {

      console.error(
        "OpenAI API error:",
        data?.error?.message ||
        openAIResponse.status
      );


      return res.status(500).json({
        error:
          "AI 분석 요청에 실패했습니다."
      });

    }



    /*
    ==========================================
    AI가 생성한 텍스트 찾기
    ==========================================
    */

    let analysis = "";


    if (data.output_text) {

      analysis =
        data.output_text;

    } else {

      /*
        raw HTTP 응답에서는
        output 배열 안에 텍스트가 들어올 수 있으므로
        안전하게 찾아준다.
      */

      const outputItems =
        data.output || [];


      for (
        const outputItem
        of outputItems
      ) {

        if (
          outputItem.type !==
          "message"
        ) {

          continue;

        }


        const contents =
          outputItem.content || [];


        for (
          const content
          of contents
        ) {

          if (
            content.type ===
            "output_text" &&
            content.text
          ) {

            analysis +=
              content.text;

          }

        }

      }

    }



    /*
      텍스트가 하나도 없으면 오류
    */

    if (!analysis) {

      return res.status(500).json({
        error:
          "AI 분석 결과가 비어 있습니다."
      });

    }



    /*
    ==========================================
    브라우저에 결과 전달
    ==========================================
    */

    return res.status(200).json({

      analysis:
        analysis

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
