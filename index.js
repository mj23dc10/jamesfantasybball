const cron = require("node-cron");
const express = require("express");
const moment = require('moment');
const fs = require('fs');
const path = require("path");
const router = express.Router();
const stat_service = require("./stat-service");
const seasonStartDate = 20200730
const dotenv = require("dotenv");

dotenv.config();
app = express();
app.set("view engine", "pug");



//VIEWS
router.get("/", (req, res) => {
    fs.readFile('store/standings.json', 'utf8', (err, data) => {
        let standings = JSON.parse(data);
        standings.lastUpdated = moment(standings.lastUpdated, 'YYYYMMDD').format("dddd, MMMM Do YYYY");
        res.render("index", { standings : standings });
    });
});

router.get("/roster/:team", (req, res) => {
    fs.readFile('store/roster.json', 'utf8', (err, data) => {
        let roster = JSON.parse(data).teams.find(o => o.name === req.params.team);
        res.render("roster", { team : roster});
    });
    
});

//ENDPOINTS
/* app.get("", (req, res, next) => {
    res.send("Welcome to the James Fantasy Basketball League: Bubble 2020 Edition");
});
app.get("/standing", (req, res, next) => {
    fs.readFile('store/standings.json', 'utf8', (err, data) => {
        res.header("Content-Type", 'application/json');
        res.send(JSON.stringify(JSON.parse(data), null, 4));
    });
});
app.get("/roster", (req, res, next) => {
    fs.readFile('store/roster.json', 'utf8', (err, data) => {
        res.header("Content-Type", 'application/json');
        res.send(JSON.stringify(JSON.parse(data), null, 4));
    });
});
 */
//Run as 12 GMT which will be 08:00 ETC all games should be done and reported 
cron.schedule('0 12 * * *', async () => {
    let startDate = moment(seasonStartDate, 'YYYYMMDD').startOf('day');
    let todaysDate = moment.utc().startOf('day');
    var duration = moment.duration(todaysDate.diff(startDate));
    //Get the days since the beginning of the seson and run all those days  
    var days = duration.asDays().toFixed();
    while (days > 0) {
        let dateToRun = moment.utc().subtract(days, 'days').format('YYYYMMDD')
        console.log("Getting the Current Stats for: " + dateToRun);
        await stat_service.getCurrentStandingsByDate(dateToRun);
        days--;
    }
});

app.use("/", router);
//Add some service to get the current stadning s points totals from store/standtings file
app.listen(process.env.PORT || 9280);