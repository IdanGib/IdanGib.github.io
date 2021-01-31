import { IProfile } from "../interfaces";
import { AppUtils } from "../../logic/utils";
export class Profile implements IProfile {
    readonly id: string;
    constructor(public name: string, public image: string) {
        this.id = AppUtils.gId();
    }
}