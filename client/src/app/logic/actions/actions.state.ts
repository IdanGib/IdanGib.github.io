import { IGift, IKid, IState } from "../interfaces"; 

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