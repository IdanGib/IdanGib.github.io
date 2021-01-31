import { Gift, KidProfile, Profile, State } from "./interfaces";
export class AppState implements State {
    profile: Profile;
    kids: KidProfile[];
    gifts: Gift[];
    static profile: Profile = {
        name: '',
        image: 'https://material.angular.io/assets/img/examples/shiba1.jpg'
    };
    static kids: KidProfile[] = [];
    static gifts: Gift[] = [];

    private static readonly key = 'state';

    public static load() {
        try {
            const json = localStorage.getItem(this.key);
            if(json) {
                const obj = JSON.parse(json);
                AppState.gifts = obj.gifts;
                AppState.kids = obj.kids;
                AppState.profile = obj.profile;
            }
        } catch(e) {
            console.error('load:', e);
            alert('fail to load state');
        }
        
    }
    public static save() {
        try {
            const { gifts, kids, profile } = this;
            const json = JSON.stringify({ gifts, kids, profile });
            localStorage.setItem(AppState.key, json);
        } catch(e) {
            console.error('save:', e);
            alert('fail to save state');
        }

    }
}
