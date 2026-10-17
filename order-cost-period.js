const {calendar,defaultTimeZone,dayNumber,dateLabel}=require('./par-levels');

// Financial weeks run Monday–Sunday. Sunday's orders fund the following
// week; derive their cost dates without changing placement or usage history.
function dates(order,formatter=calendar(defaultTimeZone)){
 const created=new Date(order?.createdAt);if(!Number.isFinite(created.valueOf()))return null;
 const placed=dayNumber(created,formatter),weekday=new Date(placed*86400000).getUTCDay();
 const cost=placed+(weekday===0?1:0),offset=(new Date(cost*86400000).getUTCDay()+6)%7;
 return {placedDate:dateLabel(placed),costDate:dateLabel(cost),costWeekStart:dateLabel(cost-offset)};
}
module.exports={dates};
