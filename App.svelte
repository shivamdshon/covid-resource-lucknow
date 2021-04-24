<script>
  import { tick } from "svelte";
  import { POPULAR_CITIES, STORAGE_KEY, LocalStorage, capitalCase } from './utils';

  const inputs = {
    cities: "",
    otherAlsoSearchFor: "",
    otherExcludedKeywords: '',
  };
  const checkboxes = {
    nearMe: false,
    verifiedOnly: true,
    excludeUnverified: false,
  };
  const alsoSearchFor = {
    beds: {
      keywords: ["bed", "beds","oxygen beds","oxygenbeds"],
      checked: true
    },
    Doctors: {
      keywords: ["doctor","dr"],
      checked: true,
    },
    ICU: {
      keywords: ["icu"],
      checked: true,
    },
    oxygen: {
      keywords: ["oxygen"],
      checked: true
    },
    ventilator: {
      keywords: ["ventilator", "ventilators"],
      checked: true
    },
    fabiflu: {
      keywords: ["fabiflu"],
      checked: true
    },
    remdesivir: {
      keywords: ["remdesivir"],
      checked: false
    },
    favipiravir: {
      keywords: ["favipiravir"],
      checked: false
    },
    tocilizumab: {
      keywords: ["tocilizumab"],
      checked: false
    },
    plasma: {
      keywords: ["plasma","plazma"],
      checked: false
    },
    tiffin: {
      keywords: ["tiffin","lunch","dinner"],
      checked: false
    }
  };
  const excludeKeywords = {
    needed: {
      keywords: ['needed'],
      checked: true,
    },
    required: {
      keywords: ['required'],
      checked: true,
    }
  };

  let links = LocalStorage.getItem(STORAGE_KEY.generated_links, []);
  let popularCityLinks = [];

  $: alsoSearchFor, inputs, checkboxes, generatePopularCityLinks();

  function generatePopularCityLinks() {
    popularCityLinks = POPULAR_CITIES.map(city => {
      return {
        city,
        href: generateLinkForCity(city)
      };
    });
  }

  function getAlsoSearchForString() {
    const keywords = Object.keys(alsoSearchFor).reduce((keywordsSoFar, item) => {
      if (alsoSearchFor[item].checked) {
        return keywordsSoFar.concat(alsoSearchFor[item].keywords);
      } else {
        return keywordsSoFar;
      }
    }, []);

    if (inputs.otherAlsoSearchFor) {
      keywords.push(inputs.otherAlsoSearchFor);
    }

    if (keywords.length > 0) {
      return `(${keywords.join(" OR ")})`;
    } else {
      return "";
    }
  }

  function getExcludedKeywordsString() {
    const keywords = Object.keys(excludeKeywords).reduce((keywordsSoFar, item) => {
      if (excludeKeywords[item].checked) {
        return keywordsSoFar.concat(excludeKeywords[item].keywords);
      } else {
        return keywordsSoFar;
      }
    }, []);

    if (inputs.otherExcludedKeywords) {
      keywords.push(inputs.otherExcludedKeywords);
    }

    return keywords.map(keyword => `-"${keyword}"`).join(' ');
  }

  function generateLinkForCity(city) {
    const base = `https://twitter.com/search`;
    const params = new URLSearchParams();

    const query = [
      checkboxes.verifiedOnly && "verified",
      city.trim(),
      getAlsoSearchForString(),
      checkboxes.excludeUnverified && '-"not verified"',
      checkboxes.excludeUnverified && '-"unverified"',
      getExcludedKeywordsString(),
    ]
      .filter(Boolean)
      .join(" ");

    params.set("q", query);

    params.set("f", "live");

    if (checkboxes.nearMe) {
      params.set("lf", "on");
    }

    const link = `${base}?${params.toString()}`;

    return link;
  }

  function generate() {
    if (!inputs.cities) {
      alert("Please enter city name(s)");
      return;
    }

    const cities = inputs.cities
      .split(",")
      .map(city => city.trim())
      .filter(Boolean);

    links = cities.map(city => {
      return {
        city,
        href: generateLinkForCity(city)
      };
    });

    tick().then(() => {
      const firstItem = document.querySelector("#city-links li");

      if (firstItem) {
        firstItem.scrollIntoView();
        firstItem.focus();

        alert('Please check the Links section');
      }

      LocalStorage.setItem(STORAGE_KEY.generated_links, links);
    });
  }

  function clearSavedLinks() {
    links = [];

    LocalStorage.removeItem(STORAGE_KEY.generated_links);
  }
</script>


<style>

body {
  background-color: #FFF5F3 !important;
  
}

body{
  background: black;
  font-family: 'Source Sans Pro', sans-serif;
  font-size: 12px;
  font-weight: 400;
  text-transform: uppercase;
  letter-spacing: .1em
}

/* The End */




  * {
    box-sizing: border-box;
  }

  main {
    font-family: sans-serif;
    margin: 0 auto;
    max-width: 600px;
    padding: 0 20px 20px;
  }

  label,
  button {
    cursor: pointer;
  }

  button {
    font-size: 1.2rem;
  }

  form > div {
    margin-bottom: 12px;
  }

  li {
    margin-bottom: 4px;
  }

  .feedback {
    margin-top: 60px;
  }

  li img {
    max-width: 300px;
    height: auto;
  }

  .split {
    display: flex;
    align-items: top;
    flex-wrap: wrap;
  }

  #tips {
    width: 100%;
  }

  #city-links {
    border: 1px dashed blue;
  }

  .highlight-red {
    border: 1px solid red;
    padding: 4px;
  }

  @media screen and (min-width: 769px) {
    #main-content {
      margin-right: 20px;
      max-width: calc(100% - 20ch - 20px - 1em);
    }

    #quick-links {
      max-width: 20ch;
      flex-grow: 0;
    }

    .only-mobile {
      display: none;
    }
  }

  @media screen and (max-width: 768px) {
    .split > * {
      width: 100%;
    }

    #quick-links {
      order: 1;
    }

    #tips {
      order: 2;
    }

    #main-content {
      order: 3;
    }

    #other-resources {
      order: 4;
    }

    #donate {
      order: 5;
    }

    .list-split-on-mobile {
      display: flex;
      flex-wrap: wrap;
      padding-left: 1em;
    }

    .list-split-on-mobile > * {
      width: 50%;
    }
  }

  @media screen and (max-width: 320px) {
    .list-split-on-mobile > * {
      width: 100%;
    }
  }
</style>
<body>
  <style>

    a{color:#3273dc;cursor:pointer;text-decoration:none;}
    a:hover{color:#363636;}
    span{font-style:inherit;font-weight:inherit;}
    @media screen and (max-width:1087px){
    .is-hidden-touch{display:none!important;}
    }
    .navbar{background-color:#fff;min-height:3.25rem;position:relative;z-index:30;}
    .navbar.is-dark{background-color:#363636;color:#f5f5f5;}
    .navbar-item{color:#4a4a4a;display:block;line-height:1.5;padding:.5rem .75rem;position:relative;}
    a.navbar-item{cursor:pointer;}
    a.navbar-item:hover{background-color:#fafafa;color:#3273dc;}
    .navbar-item{display:block;-webkit-box-flex:0;-ms-flex-positive:0;flex-grow:0;-ms-flex-negative:0;flex-shrink:0;}
  
  
    @media print{
    nav{display:block;}
    a:focus{outline:thin dotted;}
    a:active,a:hover{outline:0;}
    *{background:#fff;}
    *{page-break-before:auto;border:none;text-decoration:none;}
    nav{display:none;}
    a{color:#000;}
    }
    #tag-nav{background:rgba(0,0,0,.82);top:0;min-height:0;overflow:hidden;z-index:20;display:-webkit-box;display:-ms-flexbox;display:flex;-webkit-box-pack:center;-ms-flex-pack:center;justify-content:center;}
    #tag-nav .navbar-item{font-size:14px;padding:12px 25px;font-weight:700;-webkit-transition:color .3s ease;transition:color .3s ease;}
    #tag-nav .navbar-item.color-javascript{color:#bcac29;}
    #tag-nav .navbar-item span{-webkit-transform:translateY(-1px);transform:translateY(-1px);opacity:.6;margin-right:1px;}
    #tag-nav .navbar-item:hover{background:none;color:#fff!important;}
    
    .color-css{color:#2ca9e1;}
    .color-javascript{color:#ffe725;}
    .color-angular{color:#e03237;}
    .color-react{color:#00d8ff;}
    .color-node{color:#33a956;}
    .color-laravel{color:#ff8682;}
    .color-vue{color:#49d091;}
    .color-vs-code{color:#a5d8fa;}
    .color-python{color:#fdd22d;}
    
    
    </style>
    <nav id="tag-nav" class="navbar is-dark is-hidden-touch">
    
        
                <a class="navbar-item color-react" href="https://twitter.com/search?q=verified+delhi+%28bed+OR+beds+OR+icu+OR+oxygen+OR+ventilator+OR+ventilators%29+-%22not+verified%22+-%22unverified%22+-%22needed%22+-%22need%22+-%22needs%22+-%22required%22+-%22require%22+-%22requires%22+-%22requirement%22+-%22requirements%22&f=live">
                <span>#</span>Delhi
            </a>
                <a class="navbar-item color-vue" href="https://twitter.com/search?q=verified+pune+%28bed+OR+beds+OR+icu+OR+oxygen+OR+ventilator+OR+ventilators%29+-%22not+verified%22+-%22unverified%22+-%22needed%22+-%22need%22+-%22needs%22+-%22required%22+-%22require%22+-%22requires%22+-%22requirement%22+-%22requirements%22&f=live">
                <span>#</span>Pune
            </a>
                <a class="navbar-item color-angular" href="https://twitter.com/search?q=verified+mumbai+%28bed+OR+beds+OR+icu+OR+oxygen+OR+ventilator+OR+ventilators%29+-%22not+verified%22+-%22unverified%22+-%22needed%22+-%22need%22+-%22needs%22+-%22required%22+-%22require%22+-%22requires%22+-%22requirement%22+-%22requirements%22&f=live">
                <span>#</span>Mumbai
            </a>
                <a class="navbar-item color-javascript" href="https://twitter.com/search?q=verified+bangalore+%28bed+OR+beds+OR+icu+OR+oxygen+OR+ventilator+OR+ventilators%29+-%22not+verified%22+-%22unverified%22+-%22needed%22+-%22need%22+-%22needs%22+-%22required%22+-%22require%22+-%22requires%22+-%22requirement%22+-%22requirements%22&f=live">
                <span>#</span>Bangalore
            </a>
                <a class="navbar-item color-node" href="/tag/https://twitter.com/search?q=verified+thane+%28bed+OR+beds+OR+icu+OR+oxygen+OR+ventilator+OR+ventilators%29+-%22not+verified%22+-%22unverified%22+-%22needed%22+-%22need%22+-%22needs%22+-%22required%22+-%22require%22+-%22requires%22+-%22requirement%22+-%22requirements%22&f=live">
                <span>#</span>Thane
            </a>
                <a class="navbar-item color-laravel" href="https://twitter.com/search?q=verified+hyderabad+%28bed+OR+beds+OR+icu+OR+oxygen+OR+ventilator+OR+ventilators%29+-%22not+verified%22+-%22unverified%22+-%22needed%22+-%22need%22+-%22needs%22+-%22required%22+-%22require%22+-%22requires%22+-%22requirement%22+-%22requirements%22&f=live">
                <span>#</span>Hyderabad
            </a>
                <a class="navbar-item color-vs-code" href="https://twitter.com/search?q=verified+nagpur+%28bed+OR+beds+OR+icu+OR+oxygen+OR+ventilator+OR+ventilators%29+-%22not+verified%22+-%22unverified%22+-%22needed%22+-%22need%22+-%22needs%22+-%22required%22+-%22require%22+-%22requires%22+-%22requirement%22+-%22requirements%22&f=live">
                <span>#</span>Nagpur
            </a>
                <a class="navbar-item color-python" href="https://twitter.com/search?q=verified+ahmedabad+%28bed+OR+beds+OR+icu+OR+oxygen+OR+ventilator+OR+ventilators%29+-%22not+verified%22+-%22unverified%22+-%22needed%22+-%22need%22+-%22needs%22+-%22required%22+-%22require%22+-%22requires%22+-%22requirement%22+-%22requirements%22&f=live">
                <span>#</span>Ahmedabad
            </a>
            <a class="navbar-item color-python" href="https://twitter.com/search?q=verified+chennai+%28bed+OR+beds+OR+icu+OR+oxygen+OR+ventilator+OR+ventilators%29+-%22not+verified%22+-%22unverified%22+-%22needed%22+-%22need%22+-%22needs%22+-%22required%22+-%22require%22+-%22requires%22+-%22requirement%22+-%22requirements%22&f=live">
                <span>#</span>Chennai
            </a>
            <a class="navbar-item color-python" href="https://twitter.com/search?q=verified+kolkata+%28bed+OR+beds+OR+icu+OR+oxygen+OR+ventilator+OR+ventilators%29+-%22not+verified%22+-%22unverified%22+-%22needed%22+-%22need%22+-%22needs%22+-%22required%22+-%22require%22+-%22requires%22+-%22requirement%22+-%22requirements%22&f=live">
                <span>#</span>Kolkata
            </a>
            <a class="navbar-item color-python" href="https://twitter.com/search?q=verified+jaipur+%28bed+OR+beds+OR+icu+OR+oxygen+OR+ventilator+OR+ventilators%29+-%22not+verified%22+-%22unverified%22+-%22needed%22+-%22need%22+-%22needs%22+-%22required%22+-%22require%22+-%22requires%22+-%22requirement%22+-%22requirements%22&f=live">
                <span>#</span>Jaipur
            </a>
            
        
        
    
    </nav>
<main>
	<h1>Lucknow - Covid Resources Finder</h1>
  
  <p>This is a remastered & modified version for finding covid resources in all areas of Lucknow.<br/><br/><strong>Please note, I hold no copyrights.</strong></p>
  <div class="split">
    <div id="main-content">
      <div id="tips">
        <h2>Tips</h2>
        <ol>
          <li><strong>Do NOT make advanced payments unless you are 100% sure about their authenticity</strong></li>
          <li>Check for replies under the tweets</li>
          <li>
            Make sure search results are sorted by "Latest"
            <br />
            <img src="sort-click-here.jpg" alt="" />
          </li>
        </ol>
      </div>

      <h2>Search by States/ City / Cities</h2>
      <form on:submit|preventDefault={generate}>
        <div>
          <label for="cities">List of cities (comma-separated, e.g. indore, jamnagar)</label>
          <br />
          <input type="text" bind:value={inputs.cities} id="cities" />
        </div>

        <div>
          Also search for:

          {#each Object.keys(alsoSearchFor) as item (item)}
            <div>
              <input type="checkbox" bind:checked={alsoSearchFor[item].checked} id={`alsoSearchFor-${item}`} />
              <label for={`alsoSearchFor-${item}`}>{capitalCase(item)}</label>
            </div>
          {/each}

          <div>
            <label for="alsoSearchFor-other">Other:</label>
            <input type="text" bind:value={inputs.otherAlsoSearchFor} id="alsoSearchFor-other" />
          </div>

        </div>

        <div>
          Tweets should <strong>NOT</strong> have these words:

          {#each Object.keys(excludeKeywords) as item (item)}
            <div>
              <input type="checkbox" bind:checked={excludeKeywords[item].checked} id={`excludeKeywords-${item}`} />
              <label for={`excludeKeywords-${item}`}>"{item}"</label>
            </div>
          {/each}

          <div>
            <label for="excludeKeywords-other">Other:</label>
            <input type="text" bind:value={inputs.otherExcludedKeywords} id="excludeKeywords-other" />
          </div>
        </div>

        <div>
          <input type="checkbox" bind:checked={checkboxes.nearMe} id="nearMe" />
          <label for="nearMe">Show Tweets near me</label>
        </div>

        <div>
          <input type="checkbox" bind:checked={checkboxes.verifiedOnly} id="verifiedOnly" />
          <label for="verifiedOnly">
            Show verified tweets only
            <br />
            <strong>Uncheck this for smaller cities</strong>
            <br />
            (Tweet should contain "verified")
          </label>
        </div>

        <div>
          <input type="checkbox" bind:checked={checkboxes.excludeUnverified} id="excludeUnverified" />
          <label for="excludeUnverified">
            Exclude unverified tweets
            <br />
            (Tweet should not contain "not verified" and "unverified")
          </label>
        </div>

        <div>
          <button>Generate Links</button>
        </div>
      </form>

      {#if links.length > 0}
        <h2>Your Generated Links</h2>

        <ol id="city-links">
          {#each links as link (link.href)}
            <li><a href={link.href} target="_blank" rel="noopener noreferrer">{capitalCase(link.city)}</a></li>
          {/each}
        </ol>

        <button on:click={clearSavedLinks}>Clear saved links</button>
      {/if}
    </div>
    <div id="quick-links">
      <h2>Quick Links</h2>

      <ol class="list-split-on-mobile">
        {#each popularCityLinks as link (link.href)}
          <li><a href={link.href} target="_blank" rel="noopener noreferrer">{capitalCase(link.city)}</a></li>
        {/each}
      </ol>

      <h3 class="only-mobile highlight-red">Scroll down to search for more cities and keywords</h3>
    </div>
    <div id="other-resources">
      <h2>Other Resources</h2>
      <ul>
        <li><a href="https://docs.google.com/spreadsheets/d/13my6gupVkHWMdNuz95aXQpWH3FD-deTV9KSLjoHntpg/edit#gid=0" target="_blank" rel="noopener noreferrer">Check out - Lucknow Covid Resource Spreadsheet <br/><br />(For Testing, Beds, Meds , Oxygen, Plasma, Ambulance, Hospital, Food etc). </a></li>
      </ul>
      <ul>
        <li><a href="https://covidfacts.in/" target="_blank" rel="noopener noreferrer">covidfacts.in</a></li>
      </ul>
    </div>

    <div id="other-resources">
      <h2>Telegram Group Chat For Sharing Resources (Lucknow)</h2>
      <ul>
        <li><a href="https://t.me/joinchat/c4g2zXSxhsM1ZjRl" target="_blank" rel="noopener noreferrer">Click here - For Joining the Telegram group. </a></li> <br/><br />(Note: Please share only verified sources of resource in group. )<br/>DO NOT MAKE ADVANCED PAYMENTS UNLESS YOU ARE 100% SURE ABOUT THEIR AUTHENTICITY. I hold no responsibility for your actions.
      </ul>
    </div>

    <div id="donate">
      <h2>[VOLUNTARY] Places you can Donate to</h2>
      <ul>
        <li><a href="https://hemkuntfoundation.com/donate-now/" target="_blank" rel="noopener noreferrer">Hemkunt Foundation</a> has been helping out with Oxygen Cylinders. 80G donation receipts available.</li>
      </ul>
    </div>
  </div>

  <div class="feedback">
    
    <div>Modified for Lucknow by <a href="https://www.google.com/search?q=shivamdshon" target="_blank" rel="noopener noreferrer">ShivamDShon</a></div>
  </div>

</main>
<script id="cid0020000280266646382" data-cfasync="false" async src="//st.chatango.com/js/gz/emb.js" style="width: 234px;height: 300px;">{"handle":"covidresource","arch":"js","styles":{"a":"383838","b":100,"c":"FFFFFF","d":"FFFFFF","k":"383838","l":"383838","m":"383838","n":"FFFFFF","p":"10","q":"383838","r":100,"pos":"br","cv":1,"cvbg":"ffcccc","cvfg":"000000","cvw":200,"cvh":30,"cnrs":"0.35","ticker":1}}</script>
</body>