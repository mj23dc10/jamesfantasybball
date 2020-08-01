const axios = require("axios");
const fs = require('fs');
const moment = require('moment');
const nbaDataUrlPrefix = "http://data.nba.net/10s/prod/v1/";
const scoreboard = "/scoreboard.json"
const boxscoreSuffix = "_boxscore.json"

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
    let gameIds = await getGameIdsByDate(date);
    let playStatArray = [];
    for (let gameId of gameIds) {
        try {
            const response = await axios.get(nbaDataUrlPrefix + date + "/" + gameId + boxscoreSuffix);
            const boxscoreData = response.data;
            playStatArray.push(boxscoreData.stats.activePlayers);

        } catch (error) {
            console.error(error);
        }
    }
    return playStatArray;
};
const getPointsFromPlayerStats = (stats, id) => {
    try {
        for (let game of stats) {
            for (let gameStats of game) {
                if (gameStats.personId == id) {
                    return parseInt(gameStats.points, 10);
                }
            }
        }
        return 0;
    } catch (error) {
        console.error(error);
    }
};
const getCurrentStandingsByDate = async (date) => {
    let jamesLeague = JSON.parse(fs.readFileSync('store/roster.json', 'utf8'));
    let currentStandings = JSON.parse(fs.readFileSync('store/standings.json', 'utf8'));
    //Check do we have standings up to this date
    const searchDate = moment(date, 'YYYYMMDD')
    const lastUpdate = moment(currentStandings.lastUpdated, 'YYYYMMDD')
    if (searchDate.isAfter(lastUpdate)) {
        let playerStats = await getPlayerStatsByDate(date);
        //If we have sats for that day use them
        if (playerStats.length > 0) {
            let teams = jamesLeague.teams;
            teams.forEach(team => {
                let teamStanding = currentStandings.standings.find(o => o.name === team.name);
                var totalTeamPoints = 0;
                team.roster.forEach(async player => {
                    let point = getPointsFromPlayerStats(playerStats, player.personId);
                    //console.log("Player " + player.firstName + " Points: " + point);
                    totalTeamPoints += getPointsFromPlayerStats(playerStats, player.personId);
                });
                if (teamStanding) {
                    teamStanding.points += totalTeamPoints;
                    teamStanding[date + "_points"] = totalTeamPoints
                } else {
                    currentStandings.standings.push({
                        "name": team.name,
                        "points": totalTeamPoints,
                        [date + "_points"]: totalTeamPoints
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
            console.log(currentStandings.standings)
            //Write the updates standings to disk and save
            try {
                fs.writeFileSync("store/standings.json", JSON.stringify(currentStandings, null, 4))
            } catch (err) {
                console.error(err)
            }
            
        }
    } else {
        console.warn("Already have stats for the date: " + date);
    }
};

// Call start
//(async () => {
//  console.log('before start');
// await getCurrentStandingsByDate("20200730");
// await getCurrentStandingsByDate("20200731");
//console.log('after start');
//})();

module.exports = {
    getCurrentStandingsByDate,
    getGameIdsByDate,
    getPlayerPointsByDateAndPlayerId,
    getPlayerIdByName
}