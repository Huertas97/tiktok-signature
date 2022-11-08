const Signer = require("..");
const axios = require("axios"); // NOTE: not adding this to package.json, you'll need to install it manually
const fs = require('fs')
// Reading options and commands given from command line
const yargs = require('yargs');


// Setting options from CLI
const argv = yargs
  .option('username', {
    alias: 'u',
    description: 'Tell the username from TikTok to extract videos IDs',
    type: 'string'
  })
  .option('sec_UID', {
    description: 'Tell the sec_UID from TikTok to extract videos IDs',
    type: 'string'
  })    
  .help()
  .alias('help', 'h').argv;



if (argv.username && argv.sec_UID) {
    console.log('Scrapping profile from: ', argv.username);
    console.log('Using sec_UID: ', argv.sec_UID);
  }
else {
    console.log('No username or sec_UID given.\nGet your SEC_UID from https://t.tiktok.com/api/user/detail/?uniqueId=username.');
    yargs.showHelp();
    process.exit(1);
}


// Get your SEC_UID from https://t.tiktok.com/api/user/detail/?uniqueId=username
// where `username` is your TikTok username.
const SEC_UID = argv.sec_UID
    // "MS4wLjABAAAAqB08cUbXaDWqbD6MCga2RbGTuhfO2EsHayBYx08NDrN7IE3jQuRDNNN6YwyfH6_6";
  // "MS4wLjABAAAAOESvZ2zueA0D_nRLLegP-C0Pg5iNHe8S-0-esqA17JA";
  // "MS4wLjABAAAAQ09e6Ck9CQrQQYAPLehEKMlvVS8XzmGcbNHTGXsXIZSIj7Pe21eYtDq0nzKy6-5V";
  

// We use Apple, based on the issue comments in the repo, this helps prevent TikTok's captcha from triggering
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/101.0.4951.64 Safari/537.36 Edg/101.0.1210.53";

// This the final URL you make a request to for the API call, it is ALWAYS this, do not mistaken it for the signed URL
const TT_REQ_PERM_URL =
  "https://www.tiktok.com/api/post/item_list/?aid=1988&app_language=en&app_name=tiktok_web&battery_info=1&browser_language=en-US&browser_name=Mozilla&browser_online=true&browser_platform=Win32&browser_version=5.0%20%28Windows%20NT%2010.0%3B%20Win64%3B%20x64%29%20AppleWebKit%2F537.36%20%28KHTML%2C%20like%20Gecko%29%20Chrome%2F104.0.5112.81%20Safari%2F537.36%20Edg%2F104.0.1293.54&channel=tiktok_web&cookie_enabled=true&device_id=7132764148269827589&device_platform=web_pc&focus_state=false&from_page=user&history_len=2&is_fullscreen=false&is_page_visible=true&os=windows&priority_region=&referer=&region=RO&screen_height=1080&screen_width=1920&tz_name=Europe%2FBucharest&verifyFp=verify_l6xh4etd_sOgxjaYJ_yA8A_443j_Abzf_DXcCohMuHsiY&webcast_language=en&msToken=2-YQoDnPcbE-S2LNBdPKY3yFLevlAyymGgmpUV2pTw9wPx8zNenbM3_k6qzpij2fP4lLX60PUD3ioBDLcwtha9ezlAxXIMx4Nf97fTnECSgDJp33R8z9o-JHTrX3rVMGDdOUU8Y=&X-Bogus=DFSzswjEwV0AN9xsS6EXkGXyYJW1&_signature=_02B4Z6wo00001CDFs.AAAIDBA2SdXY0j46Agxb9AAGrU3c";

const PARAMS = {
  aid: "1988",
  count: 30,
  secUid: SEC_UID,
  cursor: 0,
  cookie_enabled: true,
  screen_width: 0,
  screen_height: 0,
  browser_language: "",
  browser_platform: "",
  browser_name: "",
  browser_version: "",
  browser_online: "",
  timezone_name: "Europe/London",
};

async function main() {

    var hasMore = true;
    var cursor = 0;
    var iterations = 0;

    var total_itemList = [];

    //   Iterate until TikTok's profile has no more data
    while (hasMore) {
        iterations++;
        PARAMS["cursor"] = cursor
        
        // hasMore = false
    
        const signer = new Signer(null, USER_AGENT);
        await signer.init();

        const qsObject = new URLSearchParams(PARAMS);
        const qs = qsObject.toString();

        const unsignedUrl = `https://m.tiktok.com/api/post/item_list/?${qs}`;
        const signature = await signer.sign(unsignedUrl);
    
        //   console.log("    ")
        //   console.log("Signature")
        //   console.log(signature)
        //   console.log("    ")

        const navigator = await signer.navigator();
        await signer.close();

        // We don't take the `signed_url` from the response, we use the `x-tt-params` header instead because TikTok has
        // some weird security considerations. I'm not sure if it's a local encode or they actually make a call to their
        // servers to get the signature back, but your API call params are in the `x-tt-params` header, which is used
        // when making the request to the static URL `TT_REQ_PERM_URL` above. I'm assuming because the library launches
        // a headless browser, it's a local encode.
        const { "x-tt-params": xTtParams } = signature;
        const { user_agent: userAgent } = navigator;

        const res = await testApiReq({ userAgent, xTtParams });
        const { data } = res;
        // console.log(JSON.stringify(res.data));

        var { cursor } = data;
        var { hasMore } = data;
        var { itemList } = data
        console.log("ITERATION: " + iterations +  " | hasMore: " + hasMore + " | cursor: " + cursor + " | lenght itemList: " + itemList.length )
        //   console.log(data);
        // total_itemList.push(itemList)
        total_itemList = total_itemList.concat(itemList)
    }
    
    
// convert JSON object to a string
const save_data = JSON.stringify(total_itemList)

// write JSON string to a file
fs.writeFile(argv.username + '-user.json', save_data, err => {
  if (err) {
    throw err
  }
  console.log('JSON data is saved.')
})
}

async function testApiReq({ userAgent, xTtParams }) {
  const options = {
    method: "GET",
    headers: {
      "user-agent": userAgent,
      "x-tt-params": xTtParams,
    },
    url: TT_REQ_PERM_URL,
  };
//   console.log(">>>> URL UTILIDADA: " +  JSON.stringify(options))
  return axios(options);
}

main();
