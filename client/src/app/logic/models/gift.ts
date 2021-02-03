import { IGift } from "../interfaces";
import { AppUtils } from "../utils";

export class Gift implements IGift {
    constructor(public name: string, 
                public image: string, 
                public stars: number,
                public id?: string) {
                    this.id = id || AppUtils.gId();
                }
}