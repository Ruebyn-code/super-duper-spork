// Only server code can attach this marker. JSON and HTTP headers cannot grant it.
const supportIdentity=Symbol('Opstack support identity');
const parsedBody=Symbol('Opstack parsed request body');
module.exports={supportIdentity,parsedBody,isSupport:actor=>Boolean(actor?.[supportIdentity])};
