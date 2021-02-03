import { IGift, IKid, IProfile, IState } from "./interfaces";
import { Profile } from "../logic/models/profile";
import { Gift } from "./models/gift";
import { Kid } from "./models/kid";

export class AppState implements IState {
    profile: IProfile;
    kids: IKid[];
    gifts: IGift[];

    private readonly key = 'state';

    constructor() {
        this.load();
    }

    private load() {
        try {
            const { gifts, kids, profile } = JSON.parse(localStorage.getItem(this.key)) || {};
            this.gifts = (gifts || []).map((g: IGift) => new Gift(g.name, g.image, g.stars, g.id));
            this.kids = (kids || []).map((k: IKid) => new Kid(k.name, k.image, k.stars, k.id));
            this.profile = profile || new Profile('', '');
        } catch(e) {
            console.error('load:', e);
            alert('fail to load state');
        }
        
    }

    

    public save() {
        try {
            const { gifts, kids, profile } = this;
            const json = JSON.stringify({ gifts, kids, profile });
            localStorage.setItem(this.key, json);
        } catch(e) {
            console.error('save:', e);
            alert('fail to save state');
        }

    }

    getState(): { profile: IProfile; kids: IKid[]; gifts: IGift[]; } {
        const { profile, kids, gifts } = this;
        return  { profile, kids, gifts };
    }
}
