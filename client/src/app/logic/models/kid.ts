import { IGift, IKid } from "../interfaces";
import { AppUtils } from "../utils";

export class Kid implements IKid {
    bag: IGift[];
    constructor(public name: string,
                public image: string,
                public stars: number,
                public id?: string) {
                    this.id = id || AppUtils.gId();
                    this.bag = [];
                }

    public updateStars(n: number) {
        this.stars += n;
    }

    public addToBag(...gifts: IGift[]) {
        this.bag.push(...gifts);
    }

    public removeFromBag(...gifts: IGift[]): number {
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