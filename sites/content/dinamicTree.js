/* ***** BEGIN LICENSE BLOCK *****
   * Version: MPL 1.1/GPL 2.0/LGPL 2.1
   *
   * The contents of this file are subject to the Mozilla Public License Version
   * 1.1 (the "License"); you may not use this file except in compliance with
   * the License. You may obtain a copy of the License at
   * http://www.mozilla.org/MPL/
   *
   * Software distributed under the License is distributed on an "AS IS" basis,
   * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
   * for the specific language governing rights and limitations under the
   * License.
   *
   * The Initial Developer of the Original Code
   * Portions created by the Initial Developer are Copyright (C) 2008
   * the Initial Developer. All Rights Reserved.
   *
   * Tomas Brabenec - http://brabenec.net
   * Based on code JSTreeDrive originally developed by Joker <deck@joker.exnet.su>
   *
   * Alternatively, the contents of this file may be used under the terms of
   * either the GNU General Public License Version 2 or later (the "GPL"), or
   * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
   * in which case the provisions of the GPL or the LGPL are applicable instead
   * of those above. If you wish to allow use of your version of this file only
   * under the terms of either the GPL or the LGPL, and not to allow others to
   * use your version of this file under the terms of the MPL, indicate your
   * decision by deleting the provisions above and replace them with the notice
   * and other provisions required by the LGPL or the GPL. If you do not delete
   * the provisions above, a recipient may use your version of this file under
   * the terms of any one of the MPL, the GPL or the LGPL.
   *
   * ***** END LICENSE BLOCK ***** */

function $(el) { return document.getElementById(el); }


if(typeof(ko) == "undefined") { var ko = {}; }
if(typeof(ko.extensions) == "undefined") { ko.extensions = {}; }


ko.extensions.Sites = {
    osSvc        : Components.classes["@activestate.com/koOs;1"].getService(),
    prefsSvc     : Components.classes["@activestate.com/koPrefService;1"].
                         getService(Components.interfaces.koIPrefService),
    rConnectSvc  : Components.classes["@activestate.com/koRemoteConnectionService;1"].
                         getService(Components.interfaces.koIRemoteConnectionService),
    docSvc       : Components.classes["@activestate.com/koDocumentService;1"].
                         getService(Components.interfaces.koIDocumentService),

    servers_list : null,
    links        : [],

    prefs_deleteIt : function(num) {
        var prefs = this.prefsSvc.prefs;
        this.links.splice(num,1)

        if(this.links.length == 0)
            prefs.deletePref("ko.extensions.Sites.links");
        else
            prefs.setStringPref("ko.extensions.Sites.links", this.links.join(';'));
        // ko.extensions.Sites.prefsSvc.prefs.deletePref('ko.extensions.Sites.links')
    },
    prefs_loadFrom : function() {
        var prefs = this.prefsSvc.prefs;

        if (prefs.hasStringPref("ko.extensions.Sites.links")) {
            var str = prefs.getStringPref("ko.extensions.Sites.links")
            if(str.length > 5)
                return str;
            else
                return false;
        }else{
            return false;
        }
    },
    prefs_saveTo : function(lk) {
        var prefs = this.prefsSvc.prefs;
        this.links.splice(0,0,lk)

        prefs.setStringPref("ko.extensions.Sites.links", this.links.join(';'));
    }
}


ko.extensions.Sites.S_nsITreeView = function (){
    var atomService          = Components.classes["@mozilla.org/atom-service;1"].
                                getService(Components.interfaces.nsIAtomService);

    this.mServerAtom         = atomService.getAtom("server");
    this.mComputerAtom       = atomService.getAtom("computer");
    this.mLinkAtom           = atomService.getAtom("link");
    this.mDirectoryOpen      = atomService.getAtom("directory-open");
    this.mDirectoryClose     = atomService.getAtom("directory-close");
    this.mFilenameColumnAtom = atomService.getAtom("FilenameColumn");

    this.tree_rows    = [];
}
ko.extensions.Sites.S_nsITreeView.prototype = {
// nsITreeView
    set rowCount(c) { throw "readonly property"; },
    get rowCount()  { return this.tree_rows.length;  },
    /* attribute nsITreeSelection selection; */
    set selection(s) { this.mSelection = s   ; },
    get selection()  { return this.mSelection; },
    tree                : null,
    performAction       : function(action) {},
    cycleCell           : function(num, colId) {},
    cycleHeader         : function() {},
    selectionChanged    : function() {},
    isSorted            : function()    { return false; },
    isSeparator         : function(num) { return false; },
    isContainer         : function(num) { return true ; },
    isContainerEmpty    : function(num) { return false; },
    isContainerOpen     : function(num)         { return this.tree_rows[num].open; },
    getLevel            : function(num)         { return this.tree_rows[num].depth; },
    getParentIndex      : function(num)         { return this.tree_rows[num].parent_idx; },
    getCellText         : function(num, column) { return this.tree_rows[num].name; },
    getImageSrc         : function(){return null;},
    getRowProperties    : function(num,    prop){},
    getColumnProperties : function(column, prop){},
    setTree             : function(out) { this.tree = out; },

    hasNextSibling      : function(num, after) {
        var level = this.getLevel(num);
        // March on!
        var l;
        while (++num < this.tree_rows.length) {
            l = this.getLevel(num);
            if (l < level)
                return false;
            else if (l == level && num > after)
                return true;
        }
        return false;
    },

    getCellProperties   : function(num, column, properties) {
        if (this.tree_rows[num].depth == 0) {                   // Depth is 0, it's a server
            if(this.tree_rows[num].link)
                properties.AppendElement(this.mLinkAtom);
            else if(this.tree_rows[num].path)
                properties.AppendElement(this.mComputerAtom);
            else
                properties.AppendElement(this.mServerAtom);
        } else {
            if(this.tree_rows[num].open)
                properties.AppendElement(this.mDirectoryOpen);
            else
                properties.AppendElement(this.mDirectoryClose);
        }
        properties.AppendElement(this.mFilenameColumnAtom);
    },

    toggleOpenState     : function(num) {
        window.setCursor("wait");
        try {
            var aRow = this.tree_rows[num];

            if (aRow.open) {  // It's open
                this.clear_subRows(num);
            } else {
                this.tree.rowCountChanged(num + 1, aRow.setDirList(num, this.tree_rows)); // dircount -> aRow.setDirList(num, this.tree_rows)
            }

            aRow.open = !aRow.open
            this.tree.invalidateRow(num); // �������������� ������ ����������  (expand/collapse)
        }catch(e){
            alert( 'toggleOpenState - ' + e);
        }
        window.setCursor("auto");
    },
// nsITreeView

    init_List_forView : function(list){
        this.selection.clearSelection();

        this.tree.rowCountChanged(0, -this.tree_rows.length);  // Using rowCountChanged to notify rows were removed
        this.tree_rows = ko.extensions.Sites.init_rowsList();
        this.tree.rowCountChanged(0,  this.tree_rows.length);  // Using rowCountChanged to notify rows were added
    },

    update_fileTree_fromDirRow : function(num) {
        window.setCursor("wait");
        if (num >= 0 && num < this.tree_rows.length){
            ko.extensions.Sites.F.set_filesList(this.tree_rows[num].getFileList());
        }
        window.setCursor("auto");
    },
    clear_subRows   : function(num) {
        var deletecount = 0;
        for (var t = num + 1; t < this.tree_rows.length; t++) {
            if (this.getLevel(t) > this.tree_rows[num].depth) deletecount++;
            else break;
        }
        if (deletecount) {
                this.tree_rows.splice(num + 1,  deletecount);
            this.tree.rowCountChanged(num + 1, -deletecount);
        }
    },


    edit_rowItems   : function(action, start_num, data) {
        this.selection.clearSelection();

        this.tree.rowCountChanged(0, -this.tree_rows.length);
            switch(action)
            {
                case 'add':
                    this.tree_rows.splice(start_num, 0, data);
                break;
                case 'del':
                    this.tree_rows.splice(start_num, 1);
                break;
                case 'link':
                    this.tree_rows.splice(start_num, 0, this.tree_rows[data].mkLink());
                break;
            }
        this.tree.rowCountChanged(0,  this.tree_rows.length);
    }
};


ko.extensions.Sites.F_nsITreeView = function () {
    // Date service, used to turn timestamp into pretty date string
    this._dateSvc   = Components.classes["@mozilla.org/intl/scriptabledateformat;1"].
                           getService(Components.interfaces.nsIScriptableDateFormat);
    // Remote Connection service
    this.rfService  = Components.classes["@activestate.com/koRemoteConnectionService;1"]
                          .getService(Components.interfaces.koIRemoteConnectionService);

    var atomService = Components.classes["@mozilla.org/atom-service;1"]
                     .getService(Components.interfaces.nsIAtomService);
    this.mFileAtom              = atomService.getAtom("file-icon");
    this.mFilenameColumnAtom    = atomService.getAtom("FilenameColumn");

    this.mFileXml               = atomService.getAtom("xml-icon");
    this.mFileXul               = atomService.getAtom("xul-icon");
    this.mFileHtml              = atomService.getAtom("html-icon");
    this.mFileHtm               = atomService.getAtom("htm-icon");
    this.mFileTpl               = atomService.getAtom("tpl-icon");
    this.mFileCss               = atomService.getAtom("css-icon");
    this.mFileJs                = atomService.getAtom("js-icon");
    this.mFileRb                = atomService.getAtom("rb-icon");
    this.mFilePhp               = atomService.getAtom("php-icon");
    this.mFilePy                = atomService.getAtom("py-icon");
    this.mFileC                 = atomService.getAtom("c-icon");
    this.mFileImage             = atomService.getAtom("image-icon");
    this.mFilePng               = atomService.getAtom("png-icon");
    this.mFileGif               = atomService.getAtom("gif-icon");
    this.mFileJpg               = atomService.getAtom("jpg-icon");
    this.mFileArh               = atomService.getAtom("arh-icon");
    this.mFileCmd               = atomService.getAtom("cmd-icon");
    this.mFileXpi               = atomService.getAtom("xpi-icon");
    this.mFileKpf               = atomService.getAtom("kpf-icon");

    this.file_rows = [];
}
ko.extensions.Sites.F_nsITreeView.prototype = {
    // nsITreeView
    get rowCount() { return this.file_rows.length; },

    tree                : null,
    cycleCell           : function(row, colId) {},
    cycleHeader         : function() {},
    selectionChanged    : function() {},
    toggleOpenState     : function(row)   {},
    performAction       : function(action){},
    isSorted            : function()    { return false; },
    isSeparator         : function(row) { return false; },
    isContainer         : function(row) { return false; },
    isContainerOpen     : function(row) { return false; },
    isContainerEmpty    : function(row) { return false; },
    hasNextSibling      : function(row, after) { return false; },
    setTree             : function(out) { this.tree = out; },
    getLevel            : function(row) { return  0; },
    getParentIndex      : function(row) { return -1; },
    getImageSrc         : function()    { return null; },
    getRowProperties    : function(row,prop)   {},
    getColumnProperties : function(column,prop){},
    getCellProperties   : function(row, column, properties) {
        if (column.id == "file_tree_col_name") {
            if(this.file_rows[row].ext){
                switch(this.file_rows[row].ext)
                {
                    case 'xml':
                    properties.AppendElement(this.mFileXml);
                    break;
                    case 'xul':
                    properties.AppendElement(this.mFileXul);
                    break;
                    case 'html':
                    properties.AppendElement(this.mFileHtml);
                    break;
                    case 'htm':
                    properties.AppendElement(this.mFileHtm);
                    break;
                    case 'tpl':
                    properties.AppendElement(this.mFileTpl);
                    break;
                    case 'css':
                    properties.AppendElement(this.mFileCss);
                    break;
                    case 'js':
                    properties.AppendElement(this.mFileJs);
                    break;
                    case 'rb':
                    properties.AppendElement(this.mFileRb);
                    break;
                    case 'php':
                    properties.AppendElement(this.mFilePhp);
                    break;
                    case 'py':
                    properties.AppendElement(this.mFilePy);
                    break;
                    case 'c':
                    properties.AppendElement(this.mFileC);
                    break;
                    case 'jpg':
                    case 'jpeg':
                    properties.AppendElement(this.mFileJpg);
                    break;
                    case 'png':
                    properties.AppendElement(this.mFilePng);
                    break;
                    case 'gif':
                    properties.AppendElement(this.mFileGif);
                    break;
                    case 'ico':
                    case 'bmp':
                    properties.AppendElement(this.mFileImage);
                    break;
                    case 'zip':
                    case 'rar':
                    case 'tar':
                    case 'jar':
                    case 'bz2':
                    case 'kpz':
                    case 'gz':
                    case '7z':
                    properties.AppendElement(this.mFileArh);
                    break;
                    case 'cmd':
                    case 'bat':
                    case 'csh':
                    case 'sh':
                    properties.AppendElement(this.mFileCmd);
                    break;
                    case 'xpi':
                    properties.AppendElement(this.mFileXpi);
                    break;
                    case 'kpf':
                    properties.AppendElement(this.mFileKpf);
                    break;
                    default:
                    properties.AppendElement(this.mFileAtom);
                }
            }else{
                properties.AppendElement(this.mFileAtom);
            }
            properties.AppendElement(this.mFilenameColumnAtom);
        }
    },
    getCellText         : function(row, column) {
        var rfInfo = this.file_rows[row];
        switch (column.id) {
            case 'file_tree_col_name':
                return rfInfo.name;
            case 'file_tree_col_size':
                return rfInfo.size;
            case 'file_tree_col_date':
                // pretty date string
                var modDate = new Date(rfInfo.time * 1000);
                return this._dateSvc.FormatDateTime("", this._dateSvc.dateFormatShort,
                                                        this._dateSvc.timeFormatNoSecondsForce24Hour,
                                                        modDate.getFullYear(),
                                                        modDate.getMonth()+1,
                                                        modDate.getDate(),
                                                        modDate.getHours(),
                                                        modDate.getMinutes(),
                                                        modDate.getSeconds() );
        }
        return "(Unknown column)";
    },


    set_filesList : function(files) {
        this.selection.clearSelection();

        this.tree.rowCountChanged(0, -this.file_rows.length);
        this.file_rows = files;
        this.tree.rowCountChanged(0,  this.file_rows.length);
    }
};

ko.extensions.Sites.S = new ko.extensions.Sites.S_nsITreeView();
ko.extensions.Sites.F = new ko.extensions.Sites.F_nsITreeView();
