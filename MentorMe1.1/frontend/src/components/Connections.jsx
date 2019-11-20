import React, { Component } from "react";
import ChatContainer from "./common/ChatContainer";
import axios from "axios";
import _ from "lodash";
const MESSAGE_SEND = "MESSAGE_SEND";
const MESSAGE_RECIEVE = "MESSAGE_RECIEVE";
const MESSAGE_ERROR = "MESSAGE_ERROR";
const ADD_CHAT = "ADD_CHAT";
const GET_CHATLOGS = "GET_CHATLOGS";
class Connections extends Component {
  state = {
    chats: [],
    activeChat: null,
    events: [],
    pending: []
  };

  //-------------------------------- LIFECYCLE HOOKS --------------------------------//

  componentDidMount() {
    console.log("check login send");
    this.initializeChatState();
    axios
      .get("/api/relations/pending", {
        headers: { "x-auth-token": sessionStorage.getItem("authToken") }
      })
      .then(res => {
        console.log(res.data);
        this.setState({ pending: res.data });
      })
      .catch(err => console.log(err.message));
  }
  componentWillUnmount() {
    const { events } = this.state;
    const { socket } = this.props;
    events.forEach(event => {
      socket.off(event);
    });
  }

  //---------------------------- SOCKET SETUP & HANDLERS ------------------------------//

  /**
   * Initializing required states by requesting them from the backend.
   * Sets up listeners for all chats and for potential new chats.
   */
  initializeChatState = () => {
    const { socket } = this.props;
    socket.emit(GET_CHATLOGS, this.initializationCallback);

    socket.on(ADD_CHAT, chat => {
      let newChats = [...this.state.chats, chat];
      let newEvents = [...this.state.events, `${MESSAGE_RECIEVE}-${chat.id}`];
      socket.on(
        `${MESSAGE_RECIEVE}-${chat.id}`,
        this.socketRecieverSetup(chat.id)
      );
      this.setState({ chats: newChats, events: newEvents });
    });
    this.setState({ events: [...this.state.events, ADD_CHAT] });
  };

  /**
   * Callback helper function for initialization above.
   * Is called by backend after it readies all chats.
   * Loops through all chat objects and assigns a listener for those endpoints
   */
  initializationCallback = newChats => {
    const { events } = this.state;
    const { socket } = this.props;
    console.log("Initial chatlogs recieved");
    console.log(newChats);
    const newEvents = [];
    newChats.forEach(chat => {
      newEvents.push(`${MESSAGE_RECIEVE}-${chat.id}`);
      socket.on(
        `${MESSAGE_RECIEVE}-${chat.id}`,
        this.socketRecieverSetup(chat.id)
      );
    });
    this.setState({ chats: newChats, events: [...events, ...newEvents] });
  };

  /**
   * Appending a message to the chat designated.
   * Each chat listens for their own message.
   */
  socketRecieverSetup = chatId => {
    return message => {
      const { chats } = this.state;
      let newChats = chats.map(chat => {
        if (chat.id === chatId) chat.messages.push(message);
        return chat;
      });
      this.setState({ chats: newChats });
    };
  };

  //-------------------------------- EVENT HANDLERS --------------------------------//

  /**
   * Sets the active chat to one selected.
   */
  handleSetActiveChat = chat => {
    this.setState({ activeChat: chat });
  };

  /**
   * Emits a message to the backend
   */
  handleSendMessage = (chatid, message) => {
    console.log(chatid, message);
    this.props.socket.emit(MESSAGE_SEND, chatid, message);
  };

  handleConfirmPending = rel => {
    axios
      .post(
        "/api/relations/set",
        {
          id: rel.id,
          topicid: rel.topicid,
          asmentor: Boolean(rel.asmentor)
        },
        { headers: { "x-auth-token": sessionStorage.getItem("authToken") } }
      )
      .then(res => {
        const pending = this.state.pending.filter(obj => !_.isEqual(obj, rel));
        this.setState({ pending });
      })
      .catch(err => console.log(err.message));
  };
  handleRefusePending = rel => {
    axios
      .post(
        "/api/relations/refuse",
        {
          id: rel.id,
          topicid: rel.topicid,
          asmentor: Boolean(rel.asmentor)
        },
        { headers: { "x-auth-token": sessionStorage.getItem("authToken") } }
      )
      .then(res => {
        const pending = this.state.pending.filter(obj => !_.isEqual(obj, rel));
        this.setState({ pending });
      })
      .catch(err => console.log(err.message));
  };

  //-------------------------------- RENDER FUNCTIONS --------------------------------//

  renderChatContainer() {
    const { chats, activeChat } = this.state;
    const { socket } = this.props;
    return (
      <React.Fragment>
        {activeChat ? (
          <ChatContainer
            chat={activeChat}
            socket={socket}
            messages={activeChat ? activeChat.messages : null}
            onSend={message => this.handleSendMessage(activeChat.id, message)}
          />
        ) : (
          <div className="jumbotron">
            <p className="lead">
              Select a chat on the right to begin chatting!
            </p>
          </div>
        )}
      </React.Fragment>
    );
  }

  renderConnectionList() {
    const { chats, activeChat } = this.state;

    return (
      <React.Fragment>
        <ul className="list-group">
          {chats.map(chat => (
            <li
              key={chat.id}
              onClick={() => this.handleSetActiveChat(chat)}
              className={
                chat === activeChat
                  ? "list-group-item list-group-item-primary"
                  : "list-group-item"
              }
            >
              {chat.name}
              <div className="w-100"></div>
              {chat.relations.map(rel => (
                <span key={rel.name+rel.asmentor}class="badge badge-info">
                  {rel.name}
                  {rel.asmentor ? " Mentor" : " Mentee"}
                </span>
              ))}
            </li>
          ))}
        </ul>
      </React.Fragment>
    );
  }

  renderPending() {
    const { pending } = this.state;
    let count = 0;

    return (
      <React.Fragment>
        <ul className="list-group">
          {pending.map(p => (
            <li key={++count} className="list-group-item">
              {p.first_name + " " + p.last_name}
              <span class="badge badge-info">
                {p.asmentor ? "Mentor" : "Mentee"}
              </span>
              <div />
              <button
                onClick={() => this.handleConfirmPending(p)}
                className="btn btn-primary"
              >
                Connect
              </button>
              <button
                onClick={() => this.handleRefusePending(p)}
                className="btn btn-warning"
              >
                Refuse
              </button>
            </li>
          ))}
        </ul>
      </React.Fragment>
    );
  }

  render() {
    return (
      <div className="container">
        <div className="row">
          <div className="col-9">
            <h3>Connections</h3>
            {this.renderChatContainer()}
          </div>
          <div className="col-3">
            {this.renderConnectionList()}
            {this.renderPending()}
          </div>
        </div>
      </div>
    );
  }
}

export default Connections;
