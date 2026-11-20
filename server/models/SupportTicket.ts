import { Document, Model, Schema, model } from "mongoose";

export type TicketStatus = "open" | "answered" | "closed";
export type TicketCategory = "account" | "deposit" | "withdrawal" | "trading" | "kyc" | "other";

export interface ITicketMessage {
  _id?: Schema.Types.ObjectId;
  author: Schema.Types.ObjectId;
  fromAdmin: boolean;
  body: string;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  number: number;
  user: Schema.Types.ObjectId;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  messages: ITicketMessage[];
  unreadForUser: boolean;
  unreadForAdmin: boolean;
  lastMessageAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface ISupportTicketModel extends Model<ISupportTicket> {}

const messageSchema = new Schema<ITicketMessage>(
  {
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    fromAdmin: { type: Boolean, default: false },
    body: { type: String, required: true, trim: true, maxlength: 4000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    number: { type: Number, required: true, unique: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    category: {
      type: String,
      enum: ["account", "deposit", "withdrawal", "trading", "kyc", "other"],
      default: "other",
    },
    status: { type: String, enum: ["open", "answered", "closed"], default: "open", index: true },
    messages: { type: [messageSchema], default: [] },
    unreadForUser: { type: Boolean, default: false },
    unreadForAdmin: { type: Boolean, default: true },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

supportTicketSchema.index({ status: 1, lastMessageAt: -1 });
supportTicketSchema.index({ user: 1, lastMessageAt: -1 });

export const SupportTicket = model<ISupportTicket, ISupportTicketModel>("SupportTicket", supportTicketSchema);
