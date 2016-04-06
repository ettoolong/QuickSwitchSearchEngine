let {components, Cu, Cc, Ci} = require("chrome");
let { viewFor } = require("sdk/view/core");

let self = require("sdk/self");
let data = self.data;
let windows = require("sdk/windows").browserWindows;
//let selection = require("sdk/selection"); This High-level API don't work on e10s.
let cm = require("sdk/context-menu");

let ettSSSE = {
  engines: [],
  selectIndex: 0,
  searchService: Cc["@mozilla.org/browser/search-service;1"].getService(Ci.nsIBrowserSearchService),
  ellipsis: Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefService).getBranch("").getComplexValue("intl.ellipsis", Ci.nsIPrefLocalizedString).data,
  buildSearchEngineList: function() {
    ettSSSE.engines = [];
    //build search engine list
    if(ettSSSE.searchService) {
      let n = ettSSSE.searchService.getVisibleEngines();
      for(let i = 0; i < n.length; ++i) {
        let engine = n[i];
        ettSSSE.engines.push(engine);
        if(ettSSSE.searchService.currentEngine === engine) {
          ettSSSE.selectIndex = i;
        }
      }
    }
  },

  getDOMWindow: function() {
    let utils = require('sdk/window/utils');
    let active = utils.getMostRecentBrowserWindow();
    let chromeWindow = viewFor(active);
    let aDOMWindow = chromeWindow.QueryInterface(Ci.nsIInterfaceRequestor).
        getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    return aDOMWindow;
  },

  getSearchBar: function() {
    let aDOMWindow = ettSSSE.getDOMWindow();
    let searchBar = aDOMWindow.document.getElementById('searchbar');
    return searchBar;
  },

  setToNextSearchEngine: function(searchBar) {

    if(!searchBar)
      searchBar = ettSSSE.getSearchBar();
    let index;
    if(searchBar) {
      index = searchBar.engines.indexOf(ettSSSE.searchService.currentEngine);
      ++index;
      if(index === searchBar.engines.length)
        index = 0;
      ettSSSE.searchService.currentEngine = searchBar.engines[index];
    }
    else {
      ++ettSSSE.selectIndex;
      if(ettSSSE.selectIndex === ettSSSE.engines.length)
        ettSSSE.selectIndex = 0;
      ettSSSE.searchService.currentEngine = ettSSSE.engines[ettSSSE.selectIndex];
    }
  },

  setToPrevousSearchEngine: function(searchBar) {

    if(!searchBar)
      searchBar = ettSSSE.getSearchBar();
    let index;
    if(searchBar) {
      index = searchBar.engines.indexOf(ettSSSE.searchService.currentEngine)
      --index;
      if(index === -1)
	    index = searchBar_.engines.length-1;
	  ettSSSE.searchService.currentEngine = searchBar.engines[index];
    }
    else {
      --ettSSSE.selectIndex;
      if(ettSSSE.selectIndex === -1)
        ettSSSE.selectIndex = ettSSSE.engines.length-1;
      ettSSSE.searchService.currentEngine = ettSSSE.engines[ettSSSE.selectIndex];
    }
  },

  updateSearchBar: function(searchBar) {
  },

  updateContextMenuItem: function() {
    let selectedText = ettSSSE.selectionText;
	if (!selectedText)
	  return;
	if (selectedText.length > 15)
	  selectedText = selectedText.substr(0,15) + ettSSSE.ellipsis;
	let engineName = ettSSSE.searchService.currentEngine.name;

    let aDOMWindow = ettSSSE.getDOMWindow();
    let navigatorBundle = aDOMWindow.document.getElementById('bundle_browser');
	let menuLabel = navigatorBundle.getFormattedString("contextMenuSearch", [engineName, selectedText]);
    let accessKey = navigatorBundle.getString("contextMenuSearch.accesskey");
	aDOMWindow.document.getElementById("context-searchselect").label = menuLabel;
	aDOMWindow.document.getElementById("context-searchselect").accessKey = accessKey;
  },

  onSearchBarScrollSwitch: function(event) {

    let searchBar = ettSSSE.getSearchBar();
	let index = searchBar.engines.indexOf(ettSSSE.searchService.currentEngine);
	if(event.detail < 0) {
      //scroll up
	  if(index > 0) {
        //switch to prevous search engine
	    ettSSSE.setToPrevousSearchEngine(searchBar);
      }
	}
	else {
      //scroll down
	  if(index < searchBar.engines.length-1) {
	    //switch to next search engine
	    ettSSSE.setToNextSearchEngine(searchBar);
	  }
	}
    ettSSSE.updateSearchBar(searchBar);
  },

  onSearchBarClickSwitch: function(event) {
    if(event.button == 1) {
      ettSSSE.setToNextSearchEngine();
    }
  },

  onContextMenuScrollSwitch: function(event) {
    let searchBar = ettSSSE.getSearchBar();
    let index;
    let engineCount;
    if(searchBar) {
      if(searchBar.engines.length === 0)
        return;
      index = searchBar.engines.indexOf(ettSSSE.searchService.currentEngine);
      engineCount = searchBar.engines.length;
    }
    else {
      if(ettSSSE.engines.length === 0)
        return;
      index = ettSSSE.selectIndex
      engineCount = ettSSSE.engines.length;
    }

    if(event.detail < 0) {
      //scroll up
      if(index > 0) {
        //switch to prevous search engine
        ettSSSE.setToPrevousSearchEngine(searchBar);
      }
    }
    else {
      //scroll down
      if(index < engineCount-1) {
        //switch to next search engine
        ettSSSE.setToNextSearchEngine(searchBar);
      }
    }

    ettSSSE.updateContextMenuItem();
  },

  onContextMenuClickSwitch: function(event) {
    if(event.button == 1) {
      ettSSSE.setToNextSearchEngine();
      ettSSSE.updateContextMenuItem();
    }
  },

  onContextMenuShowing: function(event) {
    if(event.target.getAttribute('id') !== "contentAreaContextMenu") {
      return;
    }
    if(ettSSSE.getSearchBar())
	  return;
	ettSSSE.buildSearchEngineList();
  },

  onWinOpen: function(chromeWindow) {

    let aDOMWindow = chromeWindow.QueryInterface(Ci.nsIInterfaceRequestor).
        getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    let searchBar = aDOMWindow.document.getElementById('searchbar');

    if(searchBar) {
      searchBar.addEventListener('DOMMouseScroll', ettSSSE.onSearchBarScrollSwitch, false);
      searchBar.addEventListener('mousedown', ettSSSE.onSearchBarClickSwitch, true);
    }

    let contentAreaContextMenu = aDOMWindow.document.getElementById('contentAreaContextMenu');

    if(contentAreaContextMenu) {
      contentAreaContextMenu.addEventListener('popupshowing', ettSSSE.onContextMenuShowing, false);
      //
      let contextSearchselect = aDOMWindow.document.getElementById('context-searchselect');
      if(contextSearchselect) {
        contextSearchselect.addEventListener("DOMMouseScroll", ettSSSE.onContextMenuScrollSwitch, false);
        contextSearchselect.addEventListener("mousedown", ettSSSE.onContextMenuClickSwitch, false);
      }
      //
    }

  },

  onWinClose: function(chromeWindow) {

    let aDOMWindow = chromeWindow.QueryInterface(Ci.nsIInterfaceRequestor).
        getInterface(Ci.nsIDOMWindowInternal || Ci.nsIDOMWindow);
    let searchBar = aDOMWindow.document.getElementById('searchbar');

    if(searchBar) {
      searchBar.removeEventListener('DOMMouseScroll', ettSSSE.onSearchBarScrollSwitch, false);
      searchBar.removeEventListener('mousedown', ettSSSE.onSearchBarClickSwitch, true);
    }

    let contentAreaContextMenu = aDOMWindow.document.getElementById('contentAreaContextMenu');

    if(contentAreaContextMenu) {
      contentAreaContextMenu.removeEventListener('popupshowing', ettSSSE.onContextMenuShowing, false);
      //
      let contextSearchselect = aDOMWindow.document.getElementById('context-searchselect');
      if(contextSearchselect) {
        contextSearchselect.removeEventListener("DOMMouseScroll", ettSSSE.onContextMenuScrollSwitch, false);
        contextSearchselect.removeEventListener("mousedown", ettSSSE.onContextMenuClickSwitch, false);
      }
      //
    }

  }

};

cm.Item({
  label: "QuickSwitchSearchEngine",
  context: cm.PredicateContext(function(context){
    ettSSSE.selectionText = context.selectionText;
    return false;
  }),
});

windows.on("open" , function (win){
  ettSSSE.onWinOpen( viewFor(win) );
});

exports.main = function (options, callbacks) {
  ettSSSE.searchService.init();
  for (let window of windows) {
    let chromeWindow = viewFor(window);
    ettSSSE.onWinOpen( chromeWindow );
  }
};

exports.onUnload = function (reason) {
  for (let window of windows) {
    let chromeWindow = viewFor(window);
    ettSSSE.onWinClose( chromeWindow );
  }
};
