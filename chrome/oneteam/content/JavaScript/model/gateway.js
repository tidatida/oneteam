function checkIfGateway(contact)
{
    if (!(contact instanceof Contact))
        contact = new Contact(contact, null, null, null, null, true);

    contact.getDiscoIdentity(false, new Callback(Gateway.prototype._onGatewayIdentity, contact));
}

function Gateway(contact)
{
}

_DECL_(Gateway, Contact).prototype =
{
    _onGatewayIdentity: function(contact, identity)
    {
        if (this instanceof Gateway || !identity || identity.category != "gateway")
            return;

        // Wrap into Gateway object
        this.__proto__ = Gateway.prototype;

        // Hide from roster
        if (!this.newItem && !this._notVisibleInRoster) {
            for (group in this.groupsIterator())
                group._onContactRemoved(this)
        }
        this._notVisibleInRoster = true;

        this.gatewayType = identity.type;
        this.gatewayName = identity.name;
        account._onGatewayAdded(this);

        for (var i in account.allContacts)
            if (account.allContacts[i].jid.normalizedJID.domain == this.jid.normalizedJID.domain)
                account.allContacts[i]._setGateway(this);

        //XXXpfx Hack needed for gateway specific icons in roster.
        account.style.modelUpdated("defaultSet");
    },

    onRegister: function()
    {
        openDialogUniq("ot:registerGateway", "chrome://oneteam/content/registerGateway.xul",
                       "chrome,centerscreen", this);
    },

    requestRegistrationForm: function(callback)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(this.jid, "get");
        iq.setQuery('jabber:iq:register');
        con.send(iq, callback);
    },

    register: function(payload, callback)
    {
        var iq = new JSJaCIQ();
        iq.setIQ(this.jid, "set");
        iq.setQuery("jabber:iq:register").
            appendChild(E4XtoDOM(payload, iq.getDoc()));
        con.send(iq, callback);
    },

    unregister: function(callback)
    {
        this.register(<remove xmlns='jabber:iq:register'/>, callback);
    },

    remove: function()
    {
        this.unregister();
        Contact.prototype.remove.call(this);
    },

    login: function()
    {
        this._sendPresence(account.currentPresence);
    },

    logout: function()
    {
        this._sendPresence(new Presence("unavailable"));
    },

    requestMapNameForm: function(callback, force)
    {
        if (force || !("_mapNameForm" in this)) {
            var iq = new JSJaCIQ();
            iq.setIQ(this.jid, "get");
            iq.setQuery('jabber:iq:gateway');
            con.send(iq, new Callback(this._mapNameFormRecv, this).
                     addArgs(callback).fromCall());
            return;
        }
        callback(this, this._mapNameForm || {});
    },

    _mapNameFormRecv: function(callback, pkt)
    {
        if (pkt.getType() != "result") {
            this._mapNameForm = null;
            callback(this, {});
            return
        }

        var ns = "jabber:iq:gateway";
        var desc = pkt.getNode().getElementsByTagNameNS(ns, "desc")[0];
        var prompt = pkt.getNode().getElementsByTagNameNS(ns, "prompt")[0];

        this._mapNameForm = {
            desc: desc && desc.textContent,
            prompt : prompt && prompt.textContent
        };

        callback(this, this._mapNameForm);
    },

    mapName: function(payload, callback)
    {
        if (!this._mapNameForm) {
            callback(payload.text().toString().replace(/@/g, "%")+"@"+this.jid);
            return
        }

        var iq = new JSJaCIQ();
        iq.setIQ(this.jid, "set");
        iq.setQuery('jabber:iq:gateway').
            appendChild(E4XtoDOM(payload, iq.getDoc()));
        con.send(iq, new Callback(this._mapNameRecv, this).
                     addArgs(callback).fromCall());
    },

    _mapNameRecv: function(callback, payload, pkt)
    {
        try {
            if (pkt.getType() == "result") {
                callback(pkt.getNode().getElementsByTagNameNS("jabber:iq:gateway", "jid")[0].textContent);
                return;
            }
        } catch (ex) {};

        callback(null);
    }
}
