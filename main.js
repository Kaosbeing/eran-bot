const config = require('./config.json');
const Discord = require('discord.js');
const fs = require('fs');
const {google} = require('googleapis');
const sheets = google.sheets('v4');
const client = new Discord.Client();
const spreadsheetID = config.spreadsheetID;

getJSONFromSpreadsheet();
let allStats = JSON.parse(fs.readFileSync("./stats.json", "utf8"));
let allInfos = JSON.parse(fs.readFileSync("./database.json", "utf8"));


client.login(config.discordBotToken);

client.on('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
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
			case "AIDE":
			case "HELP":
				sendHelpEmbed(message); 
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
			case "MONEY":
				if (args[1] == null && (args[1] == "EDIT" && args[2] == null || args[3] == null)) {
					message.channel.send("⚠️ **Argument manquant**");
					break;
				} else if (args[1] == "EDIT" && args[2] != null || args[3] != null) {
					editMoney(message, args);
					break;
				}
				let characTotalMoney = allInfos.characInfos[findIndexfromInitials(allInfos.characInfos, args[1])];
				convertMoney(message, characTotalMoney);
				break;
			case "DATE":
				changeDate(message, args);
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
			case "ROLL":
				if (args[1] == null && args[2] == null) {
					message.channel.send("⚠️ **Commande erronée**")
					break;
				} else if (args[1] != null && args[2] == null) {
					rollTheDices(message, args);
					break;
				}
				characStatTest(message, args);
				break;
			case "ELU":
				if (args[1] == "EL" || args[1] == "CR") {
					message.channel.send("Oui.")
				} else {
					message.channel.send("Non.")
				}
				break;
        }
    }
});

/**
 * Modifie la valeur de l'argent d'un perso dans database.json
 */
function editMoney(message, args) {
	let CharacToEdit = findIndexfromInitials(allInfos.characInfos, args[2]);
					
	allInfos.characInfos[CharacToEdit].money = args[3];
	fs.writeFileSync('./database.json', JSON.stringify(allInfos), err => {
		if (err)
			console.log(err);
	})
	message.channel.send("✅ **Argent de " + allInfos.characInfos[CharacToEdit].fullname + " mis à jour. Nouvelle valeur : " + allInfos.characInfos[CharacToEdit].money + ".**");
}

/**
 * Convertit un nombre de PE en différentes autres pièces
 */
function convertMoney(message, charac) {
	let PP = Math.floor(charac.money / 100000)
	let remainder = charac.money % 100000;

	let PO = Math.floor(remainder / 10000);
	remainder = remainder % 10000;

	let PA = Math.floor(remainder / 1000);
	remainder = remainder % 1000;

	let PB = Math.floor(remainder / 100);
	remainder = remainder % 100;

	let PC = Math.floor(remainder / 10);
	remainder = remainder % 10;

	let PE = remainder;

	let moneyEmbed = new Discord.MessageEmbed()
	.setColor(charac.color)
	.setTitle("Argent de " + charac.fullname)
	.setThumbnail(charac.image)
	.addFields(
		{ name : "Total", value : charac.money + " PE"},
		{ name : "Pièce de Platine", value : PP, inline: true},
		{ name : "Pièce d'Or", value : PO, inline: true},
		{ name : "Pièce d'Argent", value : PA, inline: true},
		{ name : "Pièce de Bronze", value : PB, inline: true},
		{ name : "Pièce de de Cuivre", value : PC, inline: true},
		{ name : "Pièce d'Étain", value : PE, inline: true},
	)
	.setTimestamp()
	.setFooter(message.author.username, message.author.avatarURL());

	message.channel.send(moneyEmbed);
}

/**
 * Lance des dés en fonction du nombre demandé
 */
function rollTheDices(message, args) {
	let diceValues = args[1].split("D");
	let rolls = [];
	for (i=0; i<diceValues[0]; i++) {
		rolls[i] = getRandomIntInclusive(1, diceValues[1])
	}

	let result = "```js\nRésultats : ";
	for (i=0; i<rolls.length; i++) {
		result += rolls[i];
		result += " ";
	}
	return message.channel.send(result + "```");
}

/**
 * Effectue un test sur la statistique d'un personnage
 */
function characStatTest(message, args) {
	let statRolling = allInfos.statInfos[findIndexfromInitials(allInfos.statInfos, args[1])]
	let characRolling = allInfos.characInfos[findIndexfromInitials(allInfos.characInfos, args[2])];

	if (statRolling == null) {
		return message.channel.send("⚠️ **Statistique erronée**");
	} else if (characRolling == null) {
		return message.channel.send("⚠️ **Initiales erronée**");
	}

	let statValue = allStats.values[statRolling.rowID][characRolling.columnID];
	let modifier = args[3];
	if (modifier == null) modifier = 0;
	let roll = getRandomIntInclusive(1, 100);
	
	statValue = parseInt(statValue) + parseInt(modifier);

	let diceEmbed = new Discord.MessageEmbed()
	.setColor(characRolling.color)
	.setTitle("Jet de " + statRolling.text + " pour " + characRolling.fullname)
	.setThumbnail(characRolling.image)
	.addField("Résultat du dé : " + roll, "Statistique (avec modificateur) : " + statValue)
	.setTimestamp()
	.setFooter(message.author.username, message.author.avatarURL());

	if (roll == 100) {
		diceEmbed.addField("Échec super-critique !", "☠️")

	} else if (roll >= 90 && roll < 100) {
		diceEmbed.addField("Échec critique !", "💀")
	} else if (roll < 90 && statValue < roll && roll > 10) {
		diceEmbed.addField("Échec !", "😵")
	} else if (statValue >= roll && roll > 10) {
		diceEmbed.addField("Réussite !", "💥")
	} else if (roll <= 10 && roll > 1) {
		diceEmbed.addField("Réussite critique !", "🍀")
	} else if (roll == 1) {
		diceEmbed.addField("Réussite super-critique !", "🤑")
	}
	message.channel.send(diceEmbed);
}

/**
 * Change la date stockée dans la BD
 */
function changeDate(message, args) {
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
}

/**
 * Envoie la liste de tous les dieux
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
 * Envoie un embed avec toutes les stats ou tous les statuts d'un perso
 */
function sendFicheEmbed(message, id, isStat) {
	if (id == null) {
		return message.channel.send("⚠️ **Initiales erronées**")
	}

    ficheEmbed = new Discord.MessageEmbed()
	.setColor(allInfos.characInfos[id].color)
	.setTitle(allInfos.characInfos[id].fullname)
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

function sendHelpEmbed(message) {
    helpEmbed = new Discord.MessageEmbed()
	.setColor("#717171")
	.setTitle("Aide sur les Commandes")
	.addFields(
		{ name: "À propos :", value: "Toutes les commandes peuvent être effectuées avec ou sans majuscules, peu importe.\n <> = Impératif\n [] = Facultatif" },
		{ name: "STATS <initiales>", value: "Envoie une fiche contenant toutes les statistiques d'un personnage." },
		{ name: "STATUT/STATUS <initiales>", value: "Envoie une fiche contenant toutes les informations relatives à l'état d'un personnage." },
		{ name: "DATE", value: "Affiche la date actuelle de l'univers, définie par Ena'" },
		{ name: "GOD/DIEU [numéro]", value: "Renvoie une liste de tous les dieux, ou seulement les informations d'un Dieu correspondant au numéro indiqué." },
		{ name: "ROLL <stat> <initiales> [modificateur]", value: "Effectue un test (d100) pour la statistique voulue, pour le personnage voulu. Applique un modificateur, si il est fourni." },
		{ name: "ROLL <nombre>D<nombre>", value: "Roll un nombre défini de dés, de la valeur souhaitée. Comme DiceParser." },
		{ name: "MONEY <initiales>", value: "Envoie une fiche contenant le total d'argent d'un personnage." },
		{ name: "Initiales", value: "AA - Acateacas Amygdalus\n CR = Carliotte Roseline\n UZ = Uhr'Zak Kashir Ombo\n BB = Belphoebe Brunehilda\n MZ = Mohrus Zamtrak\n AK = Améthyste Kraken\n EK = Elenket Mzururaji\n EL = Eléanor Van Moscović\n KW = Elijah Graussdaron" }
	)
	.setTimestamp()
	.setFooter(message.author.username, message.author.avatarURL());

	message.channel.send(helpEmbed);
}

/**
 * Cherche l'index d'un objet correspondant à ses initiales
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
 * Renvoie un entier aléatoire entre deux nombres donnés
 */
function getRandomIntInclusive(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min; 
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