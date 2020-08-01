const cron = require("node-cron");
const express = require("express");
const moment = require('moment');
const stat_service = require("./stat-service");
const seasonStartDate = 20200730
app = express();
//Run as 12 GMT which will be 08:00 ETC all games should be done and reported sure it 
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
//Add some service to get the current stadning s points totals from store/standtings file
app.listen("9280");