import {z } from 'zod'


export enum SupportedMessage {
    joinRoom = "JOIN_ROOM",
    sendMessage  = "SEND_MESSAGE",
    upVoteMessage = "UPVOTE_MESSAGE"

}

export type IncomingMessage = {
    type : SupportedMessage.joinRoom;
    payload : InitMessageType
} | {
    type : SupportedMessage.sendMessage;
    payload : UserMessageType
} | {
    type : SupportedMessage.upVoteMessage;
    payload : UpVoteMessageType
}

export const InitMessage = z.object({
    name : z.string(),
    userId : z.string(),
    roomId : z.string()
});
export type InitMessageType = z.infer<typeof InitMessage>;

export const UserMessage = z.object({
    userId : z.string(),
    roomId : z.string(),
    message : z.string()
});

export type UserMessageType = z.infer<typeof UserMessage>;

export const UpVoteMessage = z.object({
    userId : z.string(),
    roomId : z.string(),
    chatId : z.string()
});

export type UpVoteMessageType = z.infer<typeof UpVoteMessage>;