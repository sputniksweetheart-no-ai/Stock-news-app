export default async function handler(req, res) {
  const query = req.query.q || "삼성전자";

  // 해외 뉴스 검색용 영문 키워드
  const englishQueries = {
    "삼성전자": "Samsung Electronics",
    "SK하이닉스": "SK hynix",
    "Curiox": "Curiox Biosystems"
  };

  const englishQuery = englishQueries[query] || query;

  try {
    // 1. NAVER 뉴스
    const naverUrl =
      "https://naverapihub.apigw.ntruss.com/search/v1/news" +
      "?query=" + encodeURIComponent(query) +
      "&display=10" +
      "&start=1" +
      "&sort=date" +
      "&format=json";

    // 2. NewsData 해외 뉴스
    const newsDataUrl =
      "https://newsdata.io/api/1/latest" +
      "?apikey=" + encodeURIComponent(process.env.NEWSDATA_API_KEY) +
      "&q=" + encodeURIComponent(englishQuery) +
      "&language=en" +
      "&removeduplicate=1";

    // 두 곳에 동시에 요청
    const [naverResponse, newsDataResponse] =
      await Promise.all([
        fetch(naverUrl, {
          headers: {
            "X-NCP-APIGW-API-KEY-ID":
              process.env.NAVER_CLIENT_ID,

            "X-NCP-APIGW-API-KEY":
              process.env.NAVER_CLIENT_SECRET
          }
        }),

        fetch(newsDataUrl)
      ]);

    const naverData = await naverResponse.json();
    const newsData = await newsDataResponse.json();

    // NAVER 결과 정리
    const naverItems =
      naverResponse.ok
        ? (naverData.items || []).map(item => ({
            title: item.title,
            description: item.description,
            link: item.originallink || item.link,
            pubDate: item.pubDate,
            source: "NAVER"
          }))
        : [];

    // NewsData 결과 정리
    const globalItems =
      newsDataResponse.ok
        ? (newsData.results || []).map(item => ({
            title: item.title || "",
            description: item.description || "",
            link: item.link || "",
            pubDate: item.pubDate || item.pubDateTZ || "",
            source: "GLOBAL",
            sourceName: item.source_name || ""
          }))
        : [];

    return res.status(200).json({
      query: query,
      englishQuery: englishQuery,
      items: [
        ...naverItems,
        ...globalItems
      ],
      debug: {
        naverOK: naverResponse.ok,
        newsDataOK: newsDataResponse.ok
      }
    });

  } catch (error) {
    return res.status(500).json({
      error: "뉴스 서버 오류",
      message: error.message
    });
  }
}
