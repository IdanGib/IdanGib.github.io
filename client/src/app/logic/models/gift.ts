import { IGift } from "../interfaces";
import { AppUtils } from "../utils";

export class Gift implements IGift {
    readonly id: string;
    constructor(public name: string, 
                public image: string, 
                public stars: number) {
                    this.id = AppUtils.gId();
                }
}