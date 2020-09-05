const axios = require("axios");
const fs = require('fs');
const moment = require('moment');
const twitter = require('./twitter-service');
const nbaDataUrlPrefix = "http://data.nba.net/10s/prod/v1/";
const scoreboard = "/scoreboard.json"
const boxscoreSuffix = "_boxscore.json"
const MAX_GAMES = 64;

const getGameIdsByDate = async (date) => {
    let gameIds = [];
    try {
        const response = await axios.get(nbaDataUrlPrefix + date + scoreboard);
        const data = response.data;
        const numberOfGames = data.numGames;
        for (i = 0; i < numberOfGames; i++) {
            gameIds.push(data.games[i].gameId);
        }
        console.log(gameIds);
    } catch (error) {
        console.error(error);
    }
    return gameIds;
};

const getPlayerIdByName = async (name) => {
    try {
        const response = await axios.get(nbaDataUrlPrefix + "2019/players.json");
        const playerData = response.data;
        const playerArray = playerData.league.standard;
        let displayName = "";
        for (i = 0; i < playerArray.length; i++) {
            displayName = playerArray[i].temporaryDisplayName.toUpperCase();
            if (displayName == name.toUpperCase()) {
                console.log(name + "= " + playerArray[i].personId);
                break;
            }
        }
    } catch (error) {
        console.error(error);
    }
};

const getPlayerPointsByDateAndPlayerId = async (date, id) => {
    let gameIds = await getGameIdsByDate(date);
    for (let gameId of gameIds) {
        try {
            const response = await axios.get(nbaDataUrlPrefix + date + "/" + gameId + boxscoreSuffix);
            const boxscoreData = response.data;
            const playStatArray = boxscoreData.stats.activePlayers;
            for (let playerStats of playStatArray) {
                if (playerStats.personId == id) {
                    return playerStats.points;
                }
            }
        } catch (error) {
            console.error(error);
        }
    }
};
const getPlayerStatsByDate = async (date) => {
    const playerMap = new Map();
    let gameIds = await getGameIdsByDate(date);
    for (let gameId of gameIds) {
        try {
            const response = await axios.get(nbaDataUrlPrefix + date + "/" + gameId + boxscoreSuffix);
            const boxscoreData = response.data;
            boxscoreData.stats.activePlayers.forEach(player => {
                playerMap.set(player.personId, parseInt(player.points, 10)
                    + parseInt(player.totReb, 10)
                    + parseInt(player.assists, 10)
                    + parseInt(player.steals, 10)
                    + parseInt(player.blocks, 10))
            });
        } catch (error) {
            console.error(error);
        }
    }
    return playerMap;
};

const getCurrentStandingsByDate = async (date, rosterFile, standingFile) => {
    let jamesLeague = JSON.parse(fs.readFileSync(rosterFile, 'utf8'));
    let currentStandings = JSON.parse(fs.readFileSync(standingFile, 'utf8'));
    //Check do we have standings up to this date
    const searchDate = moment(date, 'YYYYMMDD')
    const lastUpdate = moment(currentStandings.lastUpdated, 'YYYYMMDD')
    if (searchDate.isAfter(lastUpdate)) {
        let playerStats = await getPlayerStatsByDate(date);
        //If we have sats for that day use them
        if (playerStats.size > 0) {
            let teams = jamesLeague.teams;
            teams.forEach(team => {
                let teamStanding = currentStandings.standings.find(o => o.name === team.name);
                var totalTeamPoints = 0;
                var gamesPlayed = 0;
                team.roster.forEach(async player => {
                    let points = playerStats.get(player.personId);
                    if (points) {
                        totalTeamPoints += points;
                        //gamesPlayed++;
                        if(player.totalPoints){
                            player.totalPoints += points;
                        } else {
                            player["totalPoints"] = points;
                        }

                    }
                });
                let mvp = team.roster.sort(function (a, b) {
                    return b.totalPoints - a.totalPoints;
                });
                let activePlayers = team.roster.filter(p => p.active).length;
                if (teamStanding) {
                    teamStanding.points += totalTeamPoints;
                    teamStanding[date + "_points"] = totalTeamPoints;
                    teamStanding.mvp = mvp[0].firstName + ' "' +mvp[0].nickname +'" '+ mvp[0].lastName + ' - ' + mvp[0].totalPoints;
                    teamStanding.playersLeft = activePlayers;
                } else {
                    currentStandings.standings.push({
                        "name": team.name,
                        "points": totalTeamPoints,
                        //"gamesLeft": MAX_GAMES - gamesPlayed,
                        [date + "_points"]: totalTeamPoints,
                        "mvp": mvp[0].firstName + ' "' +mvp[0].nickname +'" '+ mvp[0].lastName + ' - ' + mvp[0].totalPoints,
                        "playersLeft" : activePlayers
                    })
                }
            });
            //Sort the current standings
            let sortedStandings = currentStandings.standings.sort(function (a, b) {
                return b.points - a.points;
            });
            //Get the sorted index and set the standings paramented to that index 
            sortedStandings.forEach(team => {
                let obj = currentStandings.standings.find((o, i) => {
                    if (o.name === team.name) {
                        currentStandings.standings[i].standing = i + 1;
                        return true; // stop searching
                    }
                });
            });
            //Set the last update to the current date
            currentStandings.lastUpdated = date;
            //Write the updates standings to disk and save
            try {
                fs.writeFileSync(rosterFile, JSON.stringify(jamesLeague, null, 4));
                fs.writeFileSync(standingFile, JSON.stringify(currentStandings, null, 4));
            } catch (err) {
                console.error(err)
            }
        }
    } else {
        console.warn("Already have stats for the date: " + date);
    }
};

const updateRosterInfo = async () => {
    let jamesLeague = JSON.parse(fs.readFileSync('store/playoff-roster.json', 'utf8'));
    let players = JSON.parse(fs.readFileSync('sample-data/players.json', 'utf8'));
    let nbaTeams = JSON.parse(fs.readFileSync('sample-data/teams.json', 'utf8'));
    jamesLeague.teams.forEach(team => {
        team.roster.forEach(async player => {
            let pData = players.league.standard.find(o => o.personId === player.personId);
            if (pData) {
                player['firstName'] = pData.firstName;
                player['lastName'] = pData.lastName;
                player['jersey'] = pData.jersey;
                player['pos'] = pData.pos;
                player['yearsPro'] = pData.yearsPro;
                player['collegeName'] = pData.collegeName;
                let teamData = nbaTeams.league.standard.find(o => o.teamId === pData.teamId);
                player['teamName'] = teamData.fullName;
            }
        });
    });
    try {
        fs.writeFileSync("store/playoff-roster.json", JSON.stringify(jamesLeague, null, 4));
    } catch (err) {
        console.error(err)
    }
};

const tweetStandings = async (standingFile) => {
    fs.readFile(standingFile, 'utf8', (err, data) => {
        const currentStandings = JSON.parse(data);
        let tweetContent = "Playoff Fantasy BBall Standings: \n";
        for (entry of currentStandings.standings) {
            tweetContent += entry.standing + " " + entry.name + " Points: " + entry.points + " Games Left: " + entry.gamesLeft + "\n";
        }
        twitter.tweetScores(tweetContent);
    });
};

updateRosterInfo();
module.exports = {
    getCurrentStandingsByDate,
    getGameIdsByDate,
    getPlayerPointsByDateAndPlayerId,
    getPlayerIdByName,
    tweetStandings
}