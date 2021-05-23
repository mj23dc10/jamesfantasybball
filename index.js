const cron = require('node-cron')
const express = require('express')
const moment = require('moment')
const path = require('path')
const router = express.Router()
const stat_service = require('./stat-service')
const seasonStartDate = 20210522
const dotenv = require('dotenv')

dotenv.config()
app = express()
app.set('view engine', 'pug')

//VIEWS
router.get('/', async (req, res) => {
    await updateStandings(true)
    var standings = stat_service.getStandingsInfo()
    standings.lastUpdated = moment(standings.lastUpdated, 'YYYYMMDD').format('dddd, MMMM Do YYYY')
    res.render('index', { standings: standings })
})

router.get('/roster/:team', async (req, res) => {
    await updateStandings(true)
    let rosterData = stat_service.getRosterInfo(req.params.team)
    res.render('roster', { team: rosterData })
})

app.get('/standings', async (req, res, next) => {
    await updateStandings(true)
    var standings = stat_service.getStandingsInfo()
    res.header('Content-Type', 'application/json')
    res.send(JSON.stringify(standings), null, 4)
})

app.get('/draft', async (req, res, next) => {
    let players = await stat_service.getPlayers()
    res.render('draft', { players: players })
})

//Run as 12 GMT which will be 08:00 ETC all games should be done and reported
cron.schedule('0 12 * * *', async () => {
    await updateStandings(true)
    await stat_service.tweetStandings(standingsFile)
})

const updateStandings = async () => {
    let startDate = moment(seasonStartDate, 'YYYYMMDD').startOf('day')
    let todaysDate = moment.utc().startOf('day')
    var duration = moment.duration(todaysDate.diff(startDate))
    //Get the days since the beginning of the seson and run all those days
    var days = duration.asDays().toFixed()
    while (days > 0) {
        let dateToRun = moment.utc().subtract(days, 'days').format('YYYYMMDD')
        await stat_service.getCurrentStandingsByDate(dateToRun)
        days--
    }
}
app.use('/', router)
//Add some service to get the current stadning s points totals from store/standtings file
app.listen(process.env.PORT || 9280)
