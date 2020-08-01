const axios = require("axios");
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
    for(let gameId of gameIds) {
        try {
            const response = await axios.get(nbaDataUrlPrefix + date + "/" + gameId+boxscoreSuffix);
            const boxscoreData = response.data;
            const playStatArray = boxscoreData.stats.activePlayers;
            for(let playerStats of playStatArray) {
                if(playerStats.personId == id) {
                    console.log("Points:"+playerStats.points);
                }
            }
        } catch (error) {
            console.log(error);
        }
    }
};

getPlayerPointsByDateAndPlayerId("20200730","202695");
// getPlayerIdsByPerson('darcy');
// getGameIdsByDate("20200730");