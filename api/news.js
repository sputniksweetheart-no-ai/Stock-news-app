export default async function handler(req, res) {
  const query = req.query.q || "삼성전자";

  try {
    const url =
      "https://naverapihub.apigw.ntruss.com/search/v1/news" +
      "?query=" + encodeURIComponent(query) +
      "&display=10" +
      "&start=1" +
      "&sort=date" +
      "&format=json";

    const response = await fetch(url, {
      headers: {
        "X-NCP-APIGW-API-KEY-ID": process.env.NAVER_CLIENT_ID,
        "X-NCP-APIGW-API-KEY": process.env.NAVER_CLIENT_SECRET
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: "NAVER API 호출 실패",
        detail: data
      });
    }

    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({
      error: "서버 오류",
      message: error.message
    });
  }
}
