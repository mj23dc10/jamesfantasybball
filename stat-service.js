const axios = require("axios");
const fs = require('fs');
const moment = require('moment');
const nbaDataUrlPrefix = "http://data.nba.net/10s/prod/v1/";
const scoreboard = "/scoreboard.json"

const boxscore = "http://data.nba.net/10s/prod/v1/20200730/0021901231_boxscore.json"
const boxscoreSuffix = "_boxscore.json"

const playerMap = new Map([
    ['darcy', ['Westbrook, Russell', 'Leonard, Kawhi', 'Walker, Kemba', 'Middleton, Khris', 'Brown, Jaylen', 'Harris, Tobias', 'Warren, T.J.', 'Fournier, Evan']]
]);

const getGameIdsByDate = async date => {
    let gameIds = [];
    try {
        const response = await axios.get(nbaDataUrlPrefix + date + scoreboard);
        const data = response.data;
        const numberOfGames = data.numGames;
        for (i = 0; i < numberOfGames; i++) {
            gameIds.push(data.games[i].gameId);
        }
        console.log(gameIds);
        // console.log(data);
    } catch (error) {
        console.log(error);
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
        console.log(error);
    }
};

const getPlayerIdsByPerson = (personName) => {
    for (let [person, players] of playerMap.entries()) {
        if (person == personName) {
            for (let player of players) {
                getPlayerIdByName(player);
            }
        }
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
                    //console.log("Points:" + playerStats.points);
                    return playerStats.points;
                }
            }
        } catch (error) {
            console.log(error);
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
            console.log(error);
        }
    }
    return playStatArray;
};
const getPointsFromPlayerStats = (stats, id) => {
    try {
        //console.log(stats);
        for (let game of stats) {
            for (let gameStats of game) {
                if (gameStats.personId == id) {
                    return parseInt(gameStats.points, 10);
                }
            }
        }
        return 0;
    } catch (error) {
        console.log(error);
    }
};
const getCurrentStandingsByDate = async (date) => {
    let jamesLeague = JSON.parse(fs.readFileSync('store/roster.json', 'utf8'));
    let currentStandings = JSON.parse(fs.readFileSync('store/standings.json', 'utf8'));
    //do we have standings up to this date
    const searchDate = moment(date, 'YYYYMMDD')
    const lastUpdate = moment(currentStandings.lastUpdated, 'YYYYMMDD')
    if (searchDate.isAfter(lastUpdate)) {
        let playerStats = await getPlayerStatsByDate(date);
        let results = {
            "lastUpdated": date,
            "standings": []
        };
        let teams = jamesLeague.teams;
        teams.forEach(team => {
            let currentPointTotal = currentStandings.standings.find(o => o.name === team.name);
            var totalTeamPoints = 0;
            team.roster.forEach(async player => {
                let point = getPointsFromPlayerStats(playerStats, player.personId);
                //console.log("Player " + player.firstName + " Points: " + point);
                totalTeamPoints += getPointsFromPlayerStats(playerStats, player.personId);
            });
            results.standings.push({
                "name": team.name,
                "points" : currentPointTotal ? currentPointTotal.points  + totalTeamPoints : totalTeamPoints,
                 [date + "_points"] : totalTeamPoints
            })
        });
        let sortedStandings = results.standings.sort(function (a, b) {
            return b.points - a.points;
        });
        sortedStandings.forEach(team => {
            let obj = results.standings.find((o, i) => {
                if (o.name === team.name) {
                    results.standings[i].standing = i + 1;
                    return true; // stop searching
                }
            });
        });
        console.log(results);
        try {
            results = Object.assign({}, currentStandings, results);
            fs.writeFileSync("store/standings.json", JSON.stringify(results, null, 4))
        } catch (err) {
            console.error(err)
        }
    } else {
        console.error("Already Have stats for that date: " + date);
    }
};

// Call start
(async () => {
    console.log('before start');

    await getCurrentStandingsByDate("20200730");

    console.log('after start');
})();

//getPlayerPointsByDateAndPlayerId("20200730", "202695");
// getPlayerIdsByPerson('darcy');
// getGameIdsByDate("20200730");