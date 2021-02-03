import { IGift, IKid, IProfile, IState } from "../interfaces"; 

import { Kid } from "../models/kid";
import { Gift } from "../models/gift";

export class StateActions {
    static updateKids(state: IState, ...kids: Partial<IKid>[]) {
        let found: IKid;
        for(const kid of kids) {
            found = state.kids.find(f => f.id === kid.id);
            if(found) {
                found.id = kid.id;
                found.image = kid.image;
                found.name = kid.name;
                found.stars = kid.stars;
            } else {
                state.kids.push(new Kid(kid.name, kid.image, kid.stars));
            }
        }
        state.save();
    }
    static updateGifts(state: IState, ...gifts: Partial<IGift>[]) {
        let found: IGift;
        for(const g of gifts) {
            found = state.gifts.find(f => f.id === g.id);
            if(found) {
                found.id = g.id;
                found.image = g.image;
                found.name = g.name;
                found.stars = g.stars;
            } else {
                state.gifts.push(new Gift(g.name, g.image, g.stars));
            }
        }
        state.save();
    }
    static removeKids(state: IState, ...kids: Partial<IKid>[]) {
        let index = -1;
        for(const kid of kids) {
            index = state.kids.findIndex((k: IKid) => kid.id === k.id);
            if(state.kids[index]) { 
                state.kids.splice(index, 1);
            }
        }
        state.save();
    }
    static removeGifts(state: IState, ...gifts: Partial<IGift>[]) {
        let index = -1;
        for(const gift of gifts) {
            index = state.gifts.findIndex((g: IKid) => gift.id === g.id);
            if(state.gifts[index]) { 
                state.gifts.splice(index, 1);
            }
        }
        state.save();
    }
}

export class IAppAction<T> {
    ui: { click: (payload: T) => Promise<void>, process: boolean };
    run: ( payload: T ) => void;
}

export class UpdateKidStarsAction implements IAppAction<{ n: number, kid: IKid }> {
    private _state: IState;
    public ui = {
        click: async (payload: { n: number, kid: IKid }) => {
            if(this.ui.process) {
                console.error('UpdateStars: in process');
            } else {
                this.ui.process = true;
                try {
                    let { n, kid } = payload
                    await this.run({ n, kid });
                } catch(e) {
                    console.error('UpdateStars:', e);
                } finally {
                    this.ui.process = false;
                } 
            }
        },
        process: false
    };

    constructor(state: IState) {
        this._state = state;
    }

    async run(payload: { n: number, kid: IKid }) {
        const kid = this._state.kids.find(k => k.id === payload.kid.id);
        kid.stars += payload.n;
        this._state.save();
        return true;
    }
}

export class RemoveGiftAction implements IAppAction<{ gift: IGift }> {
    private _state: IState;
    public ui = {
        click: async (payload: { gift: IGift }) => {
            if(this.ui.process) {
                console.error('UpdateGiftStars: in process');
            } else {
                this.ui.process = true;
                try {
                    let { gift } = payload;
                    await this.run({ gift });
                } catch(e) {
                    console.error('UpdateGiftStars:', e);
                } finally {
                    this.ui.process = false;
                } 
            }
        },
        process: false
    };

    constructor(state: IState) {
        this._state = state;
    }

    async run(payload: { gift: IGift }) {
        const index = this._state.gifts.indexOf(payload.gift);
        if(this._state.gifts[index]) {
            this._state.gifts.splice(index, 1);
            this._state.save();
        }
        return true;
    }
}
export class CreateGiftAction implements IAppAction<{ gift: IGift }> {
    private _state: IState;
    public ui = {
        click: async (payload: { gift: IGift }) => {
            if(this.ui.process) {
                console.error('UpdateGiftStars: in process');
            } else {
                this.ui.process = true;
                try {
                    let { gift } = payload;
                    await this.run({ gift });
                } catch(e) {
                    console.error('UpdateGiftStars:', e);
                } finally {
                    this.ui.process = false;
                } 
            }
        },
        process: false
    };

    constructor(state: IState) {
        this._state = state;
    }

    async run(payload: { gift: IGift }) {
        this._state.gifts.push(payload.gift);
        this._state.save();
        return true;
    }
}

export class RemoveKidAction implements IAppAction<{ kid: IKid }> {
    private _state: IState;
    public ui = {
        click: async (payload: { kid: IKid }) => {
            if(this.ui.process) {
                console.error('RemoveKidAction: in process');
            } else {
                this.ui.process = true;
                try {
                    let { kid } = payload;
                    await this.run({ kid });
                } catch(e) {
                    console.error('RemoveKidAction:', e);
                } finally {
                    this.ui.process = false;
                } 
            }
        },
        process: false
    };

    constructor(state: IState) {
        this._state = state;
    }

    async run(payload: { kid: IKid }) {
        const index = this._state.kids.indexOf(payload.kid);
        if(this._state.kids[index]) {
            this._state.kids.splice(index, 1);
            this._state.save();
        }
        return true;
    }
}
export class CreateKidAction implements IAppAction<{ kid: IKid }> {
    private _state: IState;
    public ui = {
        click: async (payload: { kid: IKid }) => {
            if(this.ui.process) {
                console.error('CreateKidAction: in process');
            } else {
                this.ui.process = true;
                try {
                    let { kid } = payload;
                    await this.run({ kid });
                } catch(e) {
                    console.error('CreateKidAction:', e);
                } finally {
                    this.ui.process = false;
                } 
            }
        },
        process: false
    };

    constructor(state: IState) {
        this._state = state;
    }

    async run(payload: { kid: IKid }) {
        this._state.kids.push(payload.kid);
        this._state.save();
        return true;
    }
}

export class AddGiftToKidAction implements IAppAction<{ kid: IKid, gift: IGift }> {
    ui: { click: (payload: { kid: IKid; gift: IGift; }) => Promise<void>; process: boolean; };
    run: (payload: { kid: IKid; gift: IGift; }) => void;
}

export class RedeemGiftAction implements IAppAction<{ kid: IKid, gift: IGift }> {
    ui: { click: (payload: { kid: IKid; gift: IGift; }) => Promise<void>; process: boolean; };
    run: (payload: { kid: IKid; gift: IGift; }) => void;
}

export class UpdateProfileAction implements IAppAction<{ profile: IProfile}> {
    ui: { click: (payload: { profile: IProfile}) => Promise<void>; process: boolean; };
    run: (payload: { profile: IProfile}) => void;
}

