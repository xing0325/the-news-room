import { onRequestPost as __api_action_js_onRequestPost } from "C:\\Users\\david\\the-news-room\\functions\\api\\action.js"
import { onRequestPost as __api_blob_admin_js_onRequestPost } from "C:\\Users\\david\\the-news-room\\functions\\api\\blob-admin.js"
import { onRequestGet as __api_desk_js_onRequestGet } from "C:\\Users\\david\\the-news-room\\functions\\api\\desk.js"
import { onRequestGet as __api_feed_js_onRequestGet } from "C:\\Users\\david\\the-news-room\\functions\\api\\feed.js"
import { onRequestPost as __api_login_js_onRequestPost } from "C:\\Users\\david\\the-news-room\\functions\\api\\login.js"
import { onRequestGet as __api_me_js_onRequestGet } from "C:\\Users\\david\\the-news-room\\functions\\api\\me.js"
import { onRequestGet as __api_newsroom_js_onRequestGet } from "C:\\Users\\david\\the-news-room\\functions\\api\\newsroom.js"
import { onRequestPost as __api_submit_js_onRequestPost } from "C:\\Users\\david\\the-news-room\\functions\\api\\submit.js"

export const routes = [
    {
      routePath: "/api/action",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_action_js_onRequestPost],
    },
  {
      routePath: "/api/blob-admin",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_blob_admin_js_onRequestPost],
    },
  {
      routePath: "/api/desk",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_desk_js_onRequestGet],
    },
  {
      routePath: "/api/feed",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_feed_js_onRequestGet],
    },
  {
      routePath: "/api/login",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_login_js_onRequestPost],
    },
  {
      routePath: "/api/me",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_me_js_onRequestGet],
    },
  {
      routePath: "/api/newsroom",
      mountPath: "/api",
      method: "GET",
      middlewares: [],
      modules: [__api_newsroom_js_onRequestGet],
    },
  {
      routePath: "/api/submit",
      mountPath: "/api",
      method: "POST",
      middlewares: [],
      modules: [__api_submit_js_onRequestPost],
    },
  ]