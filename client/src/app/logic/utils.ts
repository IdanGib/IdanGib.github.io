import { nanoid } from "nanoid";
export class AppUtils {
    static gId(): string {
        return nanoid();
    }
}