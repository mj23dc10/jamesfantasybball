const fs = require('fs')
const moment = require('moment')
const twitter = require('./twitter-service')
const dataService = require('nba.js').data
const GAME_KEY_PREFIX = 'game_'
const rosterFile = 'store/playoff-roster.json'
const standingsFile = 'store/playoff-standings.json'
let _globalRoster
let _globalStandings
const getGameIdsByDate = async (date) => {
    let gameIds = []
    const data = await dataService.scoreboard({ date: date }).catch((err) => {
        console.error(err)
    })
    const numberOfGames = data.numGames
    for (i = 0; i < numberOfGames; i++) {
        gameIds.push(data.games[i].gameId)
    }
    console.log(date + ' Game Ids: ' + gameIds)
    return gameIds
}

const getPlayers = async () => {
    let players = await dataService.players({ year: '2020' })
    return players.league.standard
}

const _getPlayerStatsByDateAndGameIds = async (date, gameIds) => {
    const playerMap = new Map()
    console.log('Processing Game Ids: ' + gameIds)
    for (let gameId of gameIds) {
        const boxscoreData = await dataService.boxscore({ date: date, gameId: gameId }).catch((err) => {
            console.error(err)
        })
        if (boxscoreData.stats && !boxscoreData.basicGameData.isGameActivated) {
            boxscoreData.stats.activePlayers.forEach((player) => {
                playerMap.set(player.personId, parseInt(player.points, 10) + parseInt(player.totReb, 10) + parseInt(player.assists, 10) + parseInt(player.steals, 10) + parseInt(player.blocks, 10))
            })
            playerMap.set(GAME_KEY_PREFIX + gameId, true)
        }
    }
    return playerMap
}
const _getRoster = () => {
    return (_globalRoster = _globalRoster || JSON.parse(fs.readFileSync(rosterFile, 'utf8')))
}
const _getStandings = () => {
    return (_globalStandings = _globalStandings || JSON.parse(fs.readFileSync(standingsFile, 'utf8')))
}
const getCurrentStandingsByDate = async (date) => {
    let jamesLeague = _getRoster()
    let currentStandings = _getStandings()
    //Check do we have standings up to this date
    const searchDate = moment(date, 'YYYYMMDD')
    const lastUpdate = moment(currentStandings.lastUpdated, 'YYYYMMDD')
    if (searchDate.isSameOrAfter(lastUpdate)) {
        let gameIds = await getGameIdsByDate(date)
        let gamesToProcess = gameIds.filter((game) => !currentStandings.processedGames.includes(game))
        let playerStats = await _getPlayerStatsByDateAndGameIds(date, gamesToProcess)
        //If we have stass for that day and have not proccessed the game already use them
        if (playerStats.size > 0) {
            let teams = jamesLeague.teams
            currentStandings.processedGames = currentStandings.processedGames.concat(
                Array.from(playerStats.keys())
                    .filter((key) => key.startsWith(GAME_KEY_PREFIX))
                    .map((key) => key.replace(GAME_KEY_PREFIX, ''))
            )
            teams.forEach((team) => {
                let teamStanding = currentStandings.standings.find((o) => o.name === team.name)
                var totalTeamPoints = 0
                var playerPointsHistory = teamStanding ? teamStanding.playerPointsHistory : []
                team.roster.forEach(async (player) => {
                    let points = playerStats.get(player.personId)
                    let playerPoints = playerPointsHistory.find((o) => o.personId === player.personId)
                    if (points) {
                        totalTeamPoints += points
                        if (playerPoints) {
                            playerPoints.totalPoints += points
                            playerPoints.pointsHistory.push({ date: date, points: points })
                        } else {
                            playerPointsHistory.push({
                                personId: player.personId,
                                totalPoints: points,
                                firstName: player.firstName,
                                lastName: player.lastName,
                                pointsHistory: [{ date: date, points: points }],
                            })
                        }
                    }
                })

                let activePlayers = team.roster.filter((p) => p.active).length
                if (teamStanding) {
                    teamStanding.points += totalTeamPoints
                    teamStanding.playersLeft = activePlayers
                    let ph = teamStanding.pointsHistory.find((o) => o.date === date)
                    if (ph) {
                        ph.points += totalTeamPoints
                    } else {
                        teamStanding.pointsHistory.push({ date: date, points: totalTeamPoints })
                    }
                    teamStanding.playerPointsHistory = playerPointsHistory
                } else {
                    teamStanding = {
                        name: team.name,
                        points: totalTeamPoints,
                        pointsHistory: [{ date: date, points: totalTeamPoints }],
                        playersLeft: activePlayers,
                        playerPointsHistory: playerPointsHistory,
                    }
                    currentStandings.standings.push(teamStanding)
                }
                //Set the MVP
                let mvp = teamStanding.playerPointsHistory.sort(function (a, b) {
                    return b.totalPoints - a.totalPoints
                })
                if (mvp) {
                    teamStanding.mvp = mvp[0].firstName + ' ' + mvp[0].lastName + ' : ' + mvp[0].totalPoints
                }
            })
            //Sort the current standings
            let sortedStandings = currentStandings.standings.sort(function (a, b) {
                return b.points - a.points
            })
            //Get the sorted index and set the standings paramented to that index
            sortedStandings.forEach((team) => {
                let obj = currentStandings.standings.find((o, i) => {
                    if (o.name === team.name) {
                        currentStandings.standings[i].standing = i + 1
                        return true // stop searching
                    }
                })
            })
            //Set the last update to the current date
            currentStandings.lastUpdated = date
            //Write the updates standings to disk and save
            try {
                fs.writeFileSync(rosterFile, JSON.stringify(jamesLeague, null, 4))
                fs.writeFileSync(standingsFile, JSON.stringify(currentStandings, null, 4))
                _globalStandings = currentStandings
                _globalRoster = jamesLeague
            } catch (err) {
                console.error(err)
            }
        }
    } else {
        console.warn('Already have stats for the date: ' + date)
    }
}

const updateRosterInfo = async () => {
    let jamesLeague = JSON.parse(fs.readFileSync('store/playoff-roster.json', 'utf8'))
    let players = await dataService.players({ year: '2020' })
    let nbaTeams = await dataService.teams({ year: '2020' })
    jamesLeague.teams.forEach((team) => {
        team.roster.forEach(async (player) => {
            let pData = players.league.standard.find((o) => o.personId === player.personId)
            if (pData) {
                player['firstName'] = pData.firstName
                player['lastName'] = pData.lastName
                player['jersey'] = pData.jersey
                player['pos'] = pData.pos
                player['yearsPro'] = pData.yearsPro
                player['collegeName'] = pData.collegeName
                let teamData = nbaTeams.league.standard.find((o) => o.teamId === pData.teamId)
                player['teamName'] = teamData.fullName
            }
        })
    })
    try {
        fs.writeFileSync('store/playoff-roster.json', JSON.stringify(jamesLeague, null, 4))
    } catch (err) {
        console.error(err)
    }
}

const tweetStandings = async (standingFile) => {
    fs.readFile(standingFile, 'utf8', (err, data) => {
        const currentStandings = JSON.parse(data)
        let tweetContent = 'Playoff Fantasy BBall Standings: \n'
        for (entry of currentStandings.standings) {
            tweetContent += entry.standing + ' ' + entry.name + ' Points: ' + entry.points + ' Games Left: ' + entry.gamesLeft + '\n'
        }
        twitter.tweetScores(tweetContent)
    })
}

const getRosterInfo = (teamName) => {
    let roster = []
    let team = _getRoster().teams.find((o) => o.name === teamName)
    team.roster.forEach((ros) => {
        let newRoster = {}
        let teamStandings = _getStandings().standings.find((o) => o.name === teamName)
        let pointsHistory = teamStandings.playerPointsHistory.find((o) => o.personId === ros.personId)
        Object.assign(newRoster, ros, pointsHistory)
        roster.push(newRoster)
    })
    return { name: teamName, roster: roster }
}

const getStandingsInfo = () => {
    return Object.assign({}, _getStandings())
}

updateRosterInfo()
module.exports = {
    getCurrentStandingsByDate,
    getGameIdsByDate,
    getPlayers,
    getRosterInfo,
    getStandingsInfo,
    tweetStandings,
}
