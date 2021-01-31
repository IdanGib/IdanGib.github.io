import { IGift, IKidProfile, IState } from "../interfaces"; 

import { Kid } from "../models/kid";
import { Gift } from "../models/gift";

export class StateActions {
    static pushKid(state: IState, ...kids: Partial<IKidProfile>[]) {
        state.kids.push(...kids.map((k: Partial<IKidProfile>) => new Kid(k.name, k.image, k.stars)));
    }
    static pushGift(state: IState, ...gifts: Partial<IGift>[]) {
        state.gifts.push(...gifts.map((g: Partial<IGift>) => new Gift(g.name, g.image, g.stars)));
    }
}