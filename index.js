'use strict';

//https://desolate-everglades-11142.herokuapp.com/intentProcessor

const express = require('express');
const app = express()

const bodyParser = require('body-parser');

const {dialogflow, SignIn, Suggestions} = require('actions-on-google');
const dialog = dialogflow({debug: true});

const https = require('https');

const HOST = '0.0.0.0';
const PORT = 8080;

process.env.DEBUG = 'dialogflow:debug';

//ENDPOINTS URL
const ftMainEndpoint = 'https://mytimstub.azurewebsites.net/api';
const ftAmountsEndpoint = ftMainEndpoint + '/topup/amounts';
const ftCreditEndpoint = ftMainEndpoint + '/credito';
const ftPersonalInfoEndpoint = ftMainEndpoint + '/profile/getPersonalInfo';

//***************************************
//   EXTENSION
//***************************************

String.prototype.replaceAll = function(search, replacement) {
    var target = this;
    return target.replace(new RegExp(search, 'g'), replacement);
};

//***************************************
//   ASSISTANT ENDPOINT AND INTENT
//***************************************

/*app.use(function (req, res, next) {
	console.log('==============================================================================================');
	console.log(req.originalUrl);
	console.log('==============================================================================================');
    console.log('************* HEADER BEGIN');
	console.log(req.headers);
	console.log('************* HEADER END');
	console.log('************* BODY BEGIN');
	console.log(req.body);
	console.log('************* BODY END');
	console.log('==============================================================================================');
  next();
});*/
//app.use(bodyParser.json(), dialog);

dialog.intent('is_working', conv => {
	console.log('INTENT IS_WORKING');
	conv.ask('Ciao! Si sto funzionando!');
});

dialog.intent('start', conv => {
	console.log('INTENT START');
	let accessToken = conv.body.originalDetectIntentRequest.payload.user.accessToken;
	if(accessToken == undefined){
		conv.contexts.set('not_logged', 999);
		conv.ask('Benvenuto in My TIM! Grazie a me potrai effettuare ricariche, conoscere il tuo credito disponibile e avere altre informazioni utili! Sei già un utente TIM?');
	}else{
		conv.contexts.set('logged', 999);
		conv.contexts.set('home', 999);
		conv.ask('Ciao Simone! Benvenuto in My TIM! Che cosa desideri effettuare? Ricaricare o conoscere il tuo credito disponibile?');
	}
});

dialog.intent('tim_user', conv => {
	console.log('INTENT TIM_USER');
	conv.contexts.set('not_logged', 999);
	conv.ask(new SignIn());
});

dialog.intent('actions.intent.SIGN_IN', (conv, params, signin) => {
  console.log('INTENT actions.intent.SIGN_IN');
  if (signin.status !== 'OK') {
    return conv.close('Devi loggarti per poter utilizzare l\'app.');
  }
  conv.contexts.set('not_logged', 0);
  conv.contexts.set('logged', 999);
  conv.contexts.set('home', 999);
  conv.ask('Ciao Simone! Benvenuto in My TIM! Che cosa desideri effettuare? Ricaricare o conoscere il tuo credito disponibile?');
});

dialog.intent('personal_info', conv => {
	console.log('INTENT PERSONAL INFO');
	return httpGet(ftPersonalInfoEndpoint).then(function(data) {
		let response = JSON.parse(data);
		conv.contexts.set('logged', 999);
		conv.contexts.set('home', 999);
		//let ssml = '<speak>Il tuo nome è ' + response.name + ' ' + response.surname + '. Il tuo numero di telefono è <say-as interpret-as="telephone" format="3">' + response.contact_number + '</say-as>. La tua mail è ' + response.contact_mail + '. Il tuo account è di tipo ' + response.account_type.replaceAll('_', ' ') + '. Desideri altro?</speak>';
  		let ssml = '<speak>Il tuo nome è ' + response.name + ' ' + response.surname + '. La tua mail è ' + response.contact_mail + '. Il tuo account è di tipo ' + response.account_type.replaceAll('_', ' ') + '. Desideri altro?</speak>';
  		conv.ask(ssml);
	}, function(err) {
  		conv.close(err);
	});
});

dialog.intent('credit', conv => {
	console.log('INTENT CREDIT');
	return httpGet(ftCreditEndpoint + '/3351234567').then(function(data) {
		let response = JSON.parse(data);
		conv.contexts.set('logged', 999);
		conv.contexts.set('home', 999);
  		conv.ask('Il tuo credito residuo è di ' + response.credito + ' euro. Desideri altro?');
	}, function(err) {
  		conv.close(err);
	});
});

dialog.intent('recharge_cut', (conv, {cut}) => {
	console.log('INTENT RECHARGE_CUT');
	return httpGet(ftAmountsEndpoint).then(function(data) {
		let response = JSON.parse(data);
		let cuts = response.amounts;
		
		conv.data.cuts = cuts;

		if(isCutPresent(cut, cuts)){
			conv.data.selectedCut = cut;
			conv.contexts.set('logged', 999);
			conv.contexts.set('home', 0);
			conv.contexts.set('recharge_checkout_confirm', 999);
			conv.ask('Procedo con la ricarica da ' + cut + ' euro?');
		}else{
			
            let nearCuts = nearestCuts(cut, cuts);
            if (nearCuts.max_min_present == true && nearCuts.min_max_present == true){
            	conv.contexts.set('logged', 999);
				conv.contexts.set('home', 0);
				conv.contexts.set('recharge_select_cut', 999);
            	conv.ask('Il taglio di ricarica da ' + cut + ' euro non è disponibile! I tagli di ricarica disponibili piu vicini sono ' + nearCuts.max_min + ' e ' + nearCuts.min_max + ' euro. Quale desideri?');
            }else if(nearCuts.max_min_present == true){
            	conv.data.selectedCut = nearCuts.max_min;
            	conv.contexts.set('logged', 999);
				conv.contexts.set('home', 0);
				conv.contexts.set('recharge_checkout_confirm', 999);
            	conv.ask('Il taglio di ricarica da ' + cut + ' euro non è disponibile! Il taglio di ricarica disponibile piu vicino è ' + nearCuts.max_min + ' euro. Procedo?');
            }else if(nearCuts.min_max_present == true){
            	conv.data.selectedCut = nearCuts.min_max;
            	conv.contexts.set('logged', 999);
				conv.contexts.set('home', 0);
				conv.contexts.set('recharge_checkout_confirm', 999);
            	conv.ask('Il taglio di ricarica da ' + cut + ' euro non è disponibile! Il taglio di ricarica disponibile piu vicino è ' + nearCuts.min_max + ' euro. Procedo?');
            }else{
            	conv.contexts.set('logged', 999);
				conv.contexts.set('home', 0);
				conv.contexts.set('recharge_select_cut', 999);
				conv.ask(new Suggestions(formatCutsForList(cuts)));
            	conv.ask(listCuts(cuts, false));
            }
			
		}
	}, function(err) {
  		conv.close(err);
	});
});

dialog.intent('recharge_nocut', conv => {
	console.log('INTENT RECHARGE_NOCUT');
	return httpGet(ftAmountsEndpoint).then(function(data) {
		let response = JSON.parse(data);
		let cuts = response.amounts;
		
		conv.data.cuts = cuts;
		conv.contexts.set('logged', 999);
		conv.contexts.set('home', 0);
		conv.contexts.set('recharge_select_cut', 999);
		conv.ask(new Suggestions(formatCutsForList(cuts)));
  		conv.ask(listCuts(cuts, false));
	}, function(err) {
  		conv.close(err);
	});
});

dialog.intent('recharge_select_cut', (conv, {cut}) => {
	console.log('INTENT RECHARGE_SELECT_CUT');
	let finded = false;
	let cuts = conv.data.cuts;

	if(isCutPresent(cut, cuts)){
		conv.data.selectedCut = cut;
		conv.contexts.set('logged', 999);
		conv.contexts.set('recharge_checkout_confirm', 999);
		conv.contexts.set('recharge_select_cut', 0);
		conv.ask('Procedo con la ricarica da ' + cut + ' euro?');
	}else{
		conv.contexts.set('logged', 999);
		conv.contexts.set('recharge_select_cut', 999);
		conv.ask(new Suggestions(formatCutsForList(cuts)));
		conv.ask(listCuts(cuts, true));
	}
});

dialog.intent('recharge_checkout_confirm', conv => {
	console.log('INTENT RECHARGE_CHECKOUT_CONFIRM');
	conv.contexts.set('logged', 999);
	conv.contexts.set('home', 999);
	conv.contexts.set('recharge_checkout_confirm', 0);
	conv.ask('La ricarica da ' + conv.data.selectedCut + ' euro è stata effettuata. Desideri altro?');
});

//***************************************
//   APP LISTENING
//***************************************

//app.use(bodyParser.json());
//app.use(bodyParser.urlencoded({ extended: false }));
app.get('/get_test', (req, res) => {
	console.log('get_test endpoint');
	httpGet('https://10.22.238.196:8443/apigw/isalive').then(function(data) {
		res.status(200).send(data);
	}, function(err) {
  		res.status(200).send('Error!!!');
	});
});

app.get('/test_test', (req, res) => {
	console.log('test_test endpoint');
  	res.status(200).send('test_test');
});

app.get('/imalive', (req, res) => {
	console.log('Imalive endpoint');
  	res.status(200).send('Im alive');
});
app.get('/', (req, res) => {
	console.log('root endpoint');
  	res.status(200).send('Im alive');
});

/*app
  .use(express.static(path.join(__dirname, 'public')))
  .set('views', path.join(__dirname, 'views'))
  .set('view engine', 'ejs')
  .listen(PORT, () => console.log(`Listening on ${ PORT }`));*/

  app.listen(PORT, HOST);

//***************************************
//   UTILS
//***************************************

function listCuts(cuts, sayCutNotAvailable){
	let ssml;
	if(sayCutNotAvailable){
		ssml = '<speak>Il taglio di ricarica da te richiesto non è disponibile! I tagli di ricarica disponibili sono <break time="0.3"/>';
	}else{
		ssml = '<speak>I tagli di ricarica disponibili sono <break time="0.3"/>';
	}

	let i;
	for (i = 0; i < cuts.length; i++){
		ssml += '<say-as interpret-as="cardinal">' + cuts[i] + '</say-as><break time="0.3"/>';
	}

	ssml += ' euro. Quale vuoi?</speak>';
	return ssml;
}

function isCutPresent(cut, cuts){
	let finded = false;
	let i;
	for (i = 0; i < cuts.length; i++){
		let currentCut = cuts[i];

		if(currentCut == parseInt(cut)){
			console.log('Scelto ' + cut);
			finded = true;
			break;
		}
	}

	return finded;
}

function formatCutsForList(cuts){
	let response = [];
	let i;
	for (i = 0; i < cuts.length; i++){
		let currentCut = cuts[i];
		response[i] = '€' + currentCut;
	}

	return response;
}

function nearestCuts(cut, cuts){
	let max_min = -1;
	let min_max = 9999;

	let i;
	for (i = 0; i < cuts.length; i++){
		let currentCut = cuts[i];

		if(currentCut > parseInt(cut)){
			if(currentCut < min_max){
				min_max = currentCut;
			}
		}else {
			if(currentCut > max_min){
				max_min = currentCut;
			}
		}
	}

	let result = new Object();
	if (max_min != -1){
		result.max_min_present = true;
		result.max_min = max_min;
	}else{
		result.max_min_present = false;
	}

	if (min_max != 9999){
		result.min_max_present = true;
		result.min_max = min_max;
	}else{
		result.min_max_present = false;
	}

	return result;
}

function httpGet(endpoint){
	return new Promise(function(resolve, reject) {

		https.get(endpoint, (resp) => {
  			let data = '';

  			resp.on('data', (chunk) => {
    				data += chunk;
  			});

  			resp.on('end', () => {
				console.log('HTTP CALL BEGIN to ' + endpoint + ' \n' + data + '\nHTTP CALL END');
				resolve(data);	
  			});

		}).on("error", (err) => {
  			console.log('ERROR in calling ' + endpoint + ' : ' + err.message);
			reject(err);
		});
	});
}