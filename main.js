const config = require('./config.json');
const Discord = require('discord.js');
const fs = require('fs');
const {google} = require('googleapis');
const sheets = google.sheets('v4');
const client = new Discord.Client();
const spreadsheetID = config.spreadsheetID;

let allStats = JSON.parse(fs.readFileSync("./stats.json", "utf8"));
let allInfos = JSON.parse(fs.readFileSync("./database.json", "utf8"));


client.login(config.discordBotToken);

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
	getJSONFromSpreadsheet();
});

client.on('message', async message => {
	if (message.author.bot) return;
	getJSONFromSpreadsheet();
	refreshDatas();

    if (message.content.charAt(0) == "%") {
		let args = message.content.toLocaleUpperCase().slice(1).split(" ");
        switch(args[0]) {
			default:
				message.channel.send("⚠️ **Commande non reconnue**");
				break;
            case "STATS": 
				if(args[1] == null) { 
					message.channel.send("⚠️ **Argument manquant**");
					break;
				}
				sendFicheEmbed(message, findIndexfromInitials(allInfos.characInfos, args[1]), true);
				break;
			case "STATUS":
			case "STATUT":
				if(args[1] == null) { 
					message.channel.send("⚠️ **Argument manquant**");
					break;
				}
				sendFicheEmbed(message, findIndexfromInitials(allInfos.characInfos, args[1]), false);
				break;
			case "DATE":
				if (args[1] == null) {
					message.channel.send(allInfos.date);
				} else if (args[2] == null) {
					message.channel.send("⚠️ **Commande erronée**");
				} else if (args[1] == "EDIT") {
					refreshDatas();
					dateToStore = message.content.slice(11);
					allInfos.date = dateToStore;

					fs.writeFileSync('./database.json', JSON.stringify(allInfos), err => {
						if (err)
							console.log(err);
					})

					message.channel.send('✅ **Date modifiée. Nouvelle date : "' + dateToStore + '"**')
				} else {
					message.channel.send("⚠️ **Commande erronée**");
				}
				break;
			case "GOD":
			case "DIEU":
				if (args[1] == null) {
					sendAllGods(message);
				} else {
					message.channel.send(allInfos.gods[findIndexfromID(allInfos.gods, args[1])].name);
					if (allInfos.gods[findIndexfromID(allInfos.gods, args[1])].text != null) {
						message.channel.send(allInfos.gods[findIndexfromID(allInfos.gods, args[1])].text);
					}
				}
				break;
			/*
			case "FIND":
				message.channel.send(findIndexfromInitials(message, args[1]));
				break;
			case "EDIT":
				if(args[1] == null || args[2] == null || args[3] == null) { 
					message.channel.send("⚠️ **Argument manquant**");
					break;
				} else if (findIndexfromInitials(allInfos.characInfos, args[1]) == null || findIndexfromInitials(allInfos.statInfos, args[2]) == null) {
					message.channel.send("⚠️ **Argument invalide**");
					break;
				}
				editAStat(message, args);
				break;*/
        }
    }
});

/*function editAStat(message, args) {
	let characToUpdate = findIndexfromInitials(allInfos.characInfos, args[1]).columnID + 1;
	let statToUpdate = findIndexfromInitials(allInfos.statInfos, args[2]).rowID + 1;
	let newValue = args[3];

	let range = convertToA1Notation(characToUpdate, statToUpdate);
	updateSpreadsheet (range, newValue);
}*/

/**
 * Envoie la liste de tous les dieux
 * @param {Discord.message} message 
 */
function sendAllGods(message) {
    let allGodsString = "";
    let arrayAllGods = [];
    for(i=0;i<allInfos.gods.length;i++) {
        arrayAllGods[i] = (allInfos.gods[i].name)
    }
    allGodsString = arrayAllGods.join(`\n`)
    message.channel.send(allGodsString);
}

/**
 * BROKEN
 * Envoie un embed avec toutes les stats d'un perso
 */
function sendFicheEmbed(message, id, isStat) {
    ficheEmbed = new Discord.MessageEmbed()
	.setColor(allInfos.characInfos[id].color)
	.setTitle(allInfos.characInfos[id].fullname)
	/*.addFields(
		{ name: "stat.fullname", value: allStats.values[12][3], inline: true })*/
	.setThumbnail(allInfos.characInfos[id].image)
	.setTimestamp()
	.setFooter(message.author.username, message.author.avatarURL());

	if (isStat) {
		let allStatistics = findIndexFromType(allInfos.statInfos, "statistics");
		allStatistics.forEach(stat => {
			ficheEmbed.addFields({ name: stat.text, value: (allStats.values[stat.rowID][allInfos.characInfos[id].columnID]), inline: stat.inline })
		});
		ficheEmbed.setAuthor("Statistiques");
	} else {
		let allStatus = findIndexFromType(allInfos.statInfos, "status");
		allStatus.forEach(stat => {
			ficheEmbed.addFields({ name: stat.text, value: (allStats.values[stat.rowID][allInfos.characInfos[id].columnID]), inline: stat.inline })
		});
		ficheEmbed.setAuthor("Statut");
	}
	message.channel.send(ficheEmbed);
}

/**
 * Cherche l'index d'un objet correspondant à ses initiales
 * 
 * @param {JSON} file 
 * @param {string} initials 
 * @returns un ID
 */
function findIndexfromInitials(file, initials) {
	let foundIndex;

	file.forEach(element => {
		if (element.initials == initials) {
			foundIndex = element.id;
		}
	});

	return foundIndex;
}

/**
 * Cherche tous les index des stats correspondant à un type
 * 
 * @param {JSON} file 
 * @param {string} type 
 * @returns un array d'ID
 */
function findIndexFromType(file, type) {
	let foundIndex = [];

	for(i=0; i<file.length; i++) {
		if (file[i].type == type) {
			foundIndex.push(file[i])
		}
	}

	return foundIndex;
}

/**
 * Cherche l'index d'un objet correspondant à son ID
 * 
 * @param {JSON} file 
 * @param {string} initials 
 * @returns un ID
 */
 function findIndexfromID(file, id) {
	let foundIndex;

	file.forEach(element => {
		if (element.id == id) {
			foundIndex = element.index;
		}
	});

	return foundIndex;
}

/**
 * Convertit deux chiffre en A1 Notation (utilisée par GSheet)
 * 
 * @param {int} colNum 
 * @param {int} rowNum 
 * @returns string
 */
 function convertToA1Notation(colNum, rowNum) {
	let A1Notation = "";

	let numToConvert = colNum;
	let letter = String.fromCharCode(97 + numToConvert);

	A1Notation += letter.toLocaleUpperCase();
	A1Notation += rowNum;

	console.log(A1Notation);
	return A1Notation;
}

/**
 * Rafraichit les données des variables contenant les JSON.
 */
function refreshDatas() {
	allStats = JSON.parse(fs.readFileSync("./stats.json", "utf8"));
	allInfos = JSON.parse(fs.readFileSync("./database.json", "utf8"));
}

/**
 * Récupère les données du spreadSheet et le met dans ./stats.json.
 */
async function getJSONFromSpreadsheet() {
	const authClient = await authorize();
	const request = {
	  // The ID of the spreadsheet to retrieve data from.
	  spreadsheetId: spreadsheetID,
  
	  // The A1 notation of the values to retrieve.
	  range: 'A1:J21',
  
	  auth: authClient,
	};
  
	try {
	  const response = (await sheets.spreadsheets.values.get(request)).data;
	  // TODO: Change code below to process the `response` object:
	  	fs.writeFileSync('./stats.json', JSON.stringify(response), err => {
			if (err)
				console.log(err);
		})
	} catch (err) {
	  console.error(err);
	}
}

/**
 * Utilise le token d'API et renvoie une autorisation.
 */
async function authorize() {
	let authClient = config.googleAPIkey;
  
	if (authClient == null) {
	  throw Error('authentication failed');
	}
  
	return authClient;
}