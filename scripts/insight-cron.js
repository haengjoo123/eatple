require('dotenv').config({ quiet:true });
const { supabaseAdmin } = require('../utils/supabaseClient');
const { InsightService } = require('../utils/insightService');
new InsightService(supabaseAdmin).run()
    .then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error.code || error.message); process.exitCode=1; });
