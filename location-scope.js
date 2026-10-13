// Records keep their original location even when their author moves elsewhere.
function belongs(record,session,ownerKey='accountId'){
 if(!record)return false;
 if(!session.locationId)return record[ownerKey]===session.id;
 if(record.locationId)return record.locationId===session.locationId;
 return (session.legacyAccountIds||[]).includes(record[ownerKey]);
}
module.exports={belongs};
