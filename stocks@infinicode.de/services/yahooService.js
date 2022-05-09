const ExtensionUtils = imports.misc.extensionUtils
const Me = ExtensionUtils.getCurrentExtension()

const { fetch } = Me.imports.helpers.fetch
const { createQuoteSummaryFromYahooData } = Me.imports.services.dto.quoteSummary
const { createQuoteHistoricalFromYahooData } = Me.imports.services.dto.quoteHistorical
const { createNewsListFromYahooData } = Me.imports.services.dto.newsList
const { INTERVAL_MAPPINGS } = Me.imports.services.meta.yahoo

const API_ENDPOINT = 'https://query2.finance.yahoo.com'
const API_VERSION_SUMMARY = 'v10/finance'
const API_VERSION_CHART = 'v8/finance'
const RSS_NEWS_ENDPOINT = 'https://feeds.finance.yahoo.com/rss/2.0/headline?s={SYMBOL}&region=US&lang=en-US'

const defaultQueryParameters = {
  formatted: 'false',
  lang: 'en-US',
  region: 'US',
  corsDomain: 'finance.yahoo.com'
}

/*************************************************/

const TAX = 0.19;
const CURR_EXCHANGE_FEE = 0.005;
const MY_SYMBOL = 'NOD.OL';
const NOK_TO_USD_SYMBOL = 'NOKUSD=X';
const USD_TO_PLN_SYMBOL = 'PLN=X';
const CURRENCY_FIELDS = {
	summaryDetail: [
		'previousClose', 'open', 'dayLow', 'dayHigh', 'regularMarketPreviousClose', 'regularMarketOpen',
		'regularMarketDayLow', 'regularMarketDayHigh', 'bid', 'ask', 'fiftyTwoWeekLow', 'fiftyTwoWeekHigh',
		'fiftyDayAverage', 'twoHundredDayAverage'
	],
	price: [
		'regularMarketPrice', 'regularMarketDayHigh', 'regularMarketDayLow',
		'regularMarketPreviousClose', 'regularMarketOpen',
	]
};


var getMySummary = async (symbol) => {

	let params;

	const COUNT = parseInt(symbol.substring(11));

	try {
		const queryParameters = {
			...defaultQueryParameters,
			modules: 'price%2CsummaryDetail%2CpageViews'
		}

		let response = await fetch({ url: `${API_ENDPOINT}/${API_VERSION_SUMMARY}/quoteSummary/${MY_SYMBOL}`, queryParameters });
		let dataStock = response.json();
		if (!response.ok) throw Error(`${response.statusText} - ${response.text()}`);

		response = await fetch({ url: `${API_ENDPOINT}/${API_VERSION_SUMMARY}/quoteSummary/${NOK_TO_USD_SYMBOL}`, queryParameters });
		let dataNOK2USD = response.json();
		if (!response.ok) throw Error(`${response.statusText} - ${response.text()}`);

		response = await fetch({ url: `${API_ENDPOINT}/${API_VERSION_SUMMARY}/quoteSummary/${USD_TO_PLN_SYMBOL}`, queryParameters });
		let dataUSD2PLN = response.json();
		if (!response.ok) throw Error(`${response.statusText} - ${response.text()}`);

		const totalMul = (1 - CURR_EXCHANGE_FEE) * (1 - CURR_EXCHANGE_FEE) * (1 - TAX) * COUNT;
		const defaultRate = dataNOK2USD.quoteSummary.result[0].price.regularMarketPrice * dataUSD2PLN.quoteSummary.result[0].price.regularMarketPrice * totalMul;

		for (let mod in CURRENCY_FIELDS) {
			for (let field of CURRENCY_FIELDS[mod]) {
				if ((field in dataNOK2USD.quoteSummary.result[0][mod]) && (field in dataUSD2PLN.quoteSummary.result[0][mod])) {
					dataStock.quoteSummary.result[0][mod][field] *= dataNOK2USD.quoteSummary.result[0][mod][field] * dataUSD2PLN.quoteSummary.result[0][mod][field] * totalMul;
				} else {
					dataStock.quoteSummary.result[0][mod][field] *= defaultRate;
				}
			}
		}
		dataStock.quoteSummary.result[0].price.regularMarketChange = dataStock.quoteSummary.result[0].price.regularMarketPrice - dataStock.quoteSummary.result[0].price.regularMarketPreviousClose;
		dataStock.quoteSummary.result[0].price.regularMarketChangePercent = dataStock.quoteSummary.result[0].price.regularMarketChange / dataStock.quoteSummary.result[0].price.regularMarketPreviousClose;
		dataStock.quoteSummary.result[0].price.currency = 'PLN';
		dataStock.quoteSummary.result[0].price.currencySymbol = 'zł';
		dataStock.quoteSummary.result[0].summaryDetail.currency = 'PLN';

		params = {
			symbol,
			quoteData: dataStock
		}

	} catch (ex) {
		params = {
			symbol,
			quoteData: {},
			error: ex.toString()
		}
	}

	return createQuoteSummaryFromYahooData(params);
}

/*************************************************/

var getQuoteSummary = async ({ symbol }) => {
  /*************************************************/
  if (symbol.startsWith('MY.SUMMARY.')) return await getMySummary(symbol);
  /*************************************************/
  const queryParameters = {
    ...defaultQueryParameters,
    modules: 'price%2CsummaryDetail%2CpageViews'
  }

  const url = `${API_ENDPOINT}/${API_VERSION_SUMMARY}/quoteSummary/${symbol}`

  const response = await fetch({ url, queryParameters })

  const params = {
    symbol,
    quoteData: response.json()
  }

  if (!response.ok) {
    params.error = `${response.statusText} - ${response.text()}`
  }

  return createQuoteSummaryFromYahooData(params)
}

var getHistoricalQuotes = async ({ symbol, range = '1mo', includeTimestamps = true }) => {
  /*************************************************/
  if (symbol.startsWith('MY.SUMMARY.')) symbol = MY_SYMBOL;
  /*************************************************/
  const queryParameters = {
    ...defaultQueryParameters,
    range,
    includePrePost: false,
    interval: INTERVAL_MAPPINGS[range],
    includeTimestamps: includeTimestamps ? 'true' : 'false'
  }

  const url = `${API_ENDPOINT}/${API_VERSION_CHART}/chart/${symbol}`
  const response = await fetch({ url, queryParameters })

  if (response.ok) {
    return createQuoteHistoricalFromYahooData(response.json())
  } else {
    return createQuoteHistoricalFromYahooData(null, `${response.statusText} - ${response.text()}`)
  }
}

var getNewsList = async ({ symbol }) => {
  const url = RSS_NEWS_ENDPOINT.replace('{SYMBOL}', symbol)

  const response = await fetch({ url })

  if (response.ok) {
    return createNewsListFromYahooData(response.text())
  } else {
    return createNewsListFromYahooData(null, `${response.statusText} - ${response.text()}`)
  }
}
