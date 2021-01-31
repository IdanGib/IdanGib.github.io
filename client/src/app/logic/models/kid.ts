import { IGift, IKid } from "../interfaces";
import { AppUtils } from "../utils";

export class Kid implements IKid {
    readonly id: string;
    bag: IGift[];
    constructor(public name: string,
                public image: string,
                public stars: number) {
                    this.id = AppUtils.gId();
                    this.bag = [];
                }

    updateStars(n: number) {
        this.stars += n;
    }

    addToBag(...gifts: IGift[]) {
        this.bag.push(...gifts);
    }

    removeFromBag(...gifts: IGift[]): number {
        let index: number;
        let count = 0;
        for(const g of gifts) {
            index = gifts.findIndex(item => item.id === g.id);
            if(gifts[index]) {
                this.bag.splice(index, 1);
                count ++;
            }
        }
        return count;
    }
}