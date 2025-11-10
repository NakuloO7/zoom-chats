import type { Chat, Store, UserId } from "./store/Store.js";
let globalChatId = 0;

interface Room {
    roomId :string,
    chats : Chat[]
}
export class InMemoryStore implements Store{
    private store : Map<string, Room>;

    constructor(){
        this.store = new Map<string, Room>();
    }

    initRoom(roomId : string){
        this.store.set(roomId, {
            roomId, 
            chats : []
        })
    }

    //if i need the last 50 chats limit = 50 and offset = 0
    //for next 50 chats limit = 50 and offset = 50
    getChats(roomId: string, limit : number, offset : number){
        const room = this.store.get(roomId);
        if(!room){
            return []
        }
        return room.chats.reverse().slice(0, offset).slice(-1 * limit)
    }

    addChat(userId :UserId,  name :string, roomId : string, message : string){
        const room = this.store.get(roomId);
        if(!room){
            return null;
        }

        const chat = {
            id : (globalChatId++).toString(),
            userId,
            name,
            message,
            upVotes : [],   //who has upvoted what
        }
        room.chats.push(chat)
        return chat;
    }

    upVote(userId : string, roomId : string, chatId : string){
        const room = this.store.get(roomId);
        if(!room){
            return
        }
        
        const chat = room.chats.find(({id})=> id === chatId);  //find if the chat is present to upvote
        if(chat){
            chat.upVotes.push(userId)
        }
        return chat;
    }
};