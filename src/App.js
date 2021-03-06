import {
  API,
  checkUserdata,
  fetchSubscriptions,
  fetchShared,
} from './utils/api.js';
import { getItem, setItem, removeItem } from './utils/storage.js';
import { trim, format, DATA } from './utils/trim.js';
import AuthPage from './components/AuthPage.js';
import UserPage from './components/UserPage.js';
import SharePage from './components/SharePage.js';
import { initRouter, push } from './utils/router.js';

export default function App({ $target }) {
  this.state = {
    isAuthorized: getItem('isAuthorized', false),
    isInitialUse: true,
    userProfile: {
      id: '',
      thumbnail: '',
      nickname: '',
    },
    subscriptionList: {
      totalResults: 0,
      items: [],
    },
    sharedList: {
      nickname: '',
      items: [],
    },
  };

  const authPage = new AuthPage({ $target });
  const userPage = new UserPage({
    $target,
    initialState: {
      thumbnail: this.state.userProfile.thumbnail,
      nickname: this.state.userProfile.nickname,
      totalResults: this.state.subscriptionList.totalResults,
      items: this.state.subscriptionList.items,
      selectedItems: this.state.sharedList.items,
    },
    onScrollEnd: async () => {
      const nextPageToken = getItem('nextPageToken');
      if (nextPageToken !== undefined) {
        // accessToken 만료되면 어쩌지?
        const accessToken = getItem('accessToken');
        const nextSubscriptionData = trim(
          await fetchSubscriptions(
            API.SUBSCRIPTIONS + `&pageToken=${nextPageToken}`,
            accessToken,
          ),
          DATA.SUBSCRIPTIONS,
        );
        if (nextSubscriptionData.nextPageToken !== undefined) {
          setItem('nextPageToken', nextSubscriptionData.nextPageToken);
        } else {
          removeItem('nextPageToken');
        }

        const nextState = {
          ...this.state,
          subscriptionList: {
            ...this.state.subscriptionList,
            ...nextSubscriptionData,
          },
        };
        this.setState(nextState, 'userPage');
      }
    },
    onClick: () => {
      alert(`http://localhost:5000/${this.state.userProfile.id} >> 공유하기`);
      console.log(`http://localhost:5000/${this.state.userProfile.id}`);
    },
    onSave: async (selectedItems) => {
      console.log('selected!!!!', selectedItems);
      const { id, nickname } = this.state.userProfile;
      const nextShareList = format(id, nickname, selectedItems);

      const fetchMethod = this.state.isInitialUse ? 'POST' : 'PUT';
      if (fetchMethod === 'POST') {
        await fetchShared('/sharetubes', {
          method: 'POST',
          body: JSON.stringify(nextShareList),
        });
      }
      if (fetchMethod === 'PUT') {
        await fetchShared(`/sharetubes/${id}`, {
          method: 'PUT',
          body: JSON.stringify(nextShareList),
        });
      }

      alert('공유 목록이 업데이트 되었습니다!');
    },
  });
  const sharePage = new SharePage({
    $target,
    initialState: {
      nickname: '',
      items: [],
    },
  });

  this.setState = (nextState, renderPage) => {
    if (renderPage === 'none') {
      this.state = nextState;
    }
    if (renderPage === 'authPage') {
      authPage.setState();
    } else if (renderPage === 'userPage') {
      this.state = nextState;

      userPage.setState({
        thumbnail: this.state.userProfile.thumbnail,
        nickname: this.state.userProfile.nickname,
        totalResults: this.state.subscriptionList.totalResults,
        items: this.state.subscriptionList.items,
        selectedItems: this.state.sharedList.items,
      });
    } else if (renderPage === 'sharePage') {
      this.state = nextState;

      sharePage.setState({
        nickname: this.state.sharedList.nickname,
        items: this.state.sharedList.items,
      });
    }
  };

  this.route = async () => {
    const { pathname } = window.location;
    const [, userId] = pathname.split('/');

    if (pathname === '/' && !this.state.isAuthorized) {
      authPage.render();
    } else if (pathname === '/callback') {
      const accessToken = location.hash.split('&')[0].substring(14);
      setItem('accessToken', accessToken);
      setItem('isAuthorized', true);

      const nextState = {
        ...this.state,
        isAuthorized: true,
      };

      this.setState(nextState, 'none');
      push('/');
    } else if (pathname === '/' && this.state.isAuthorized) {
      const accessToken = getItem('accessToken');
      const userData = trim(
        await fetchSubscriptions(API.USERINFO, accessToken),
        DATA.USERINFO,
      );
      const subscriptionData = trim(
        await fetchSubscriptions(API.SUBSCRIPTIONS, accessToken),
        DATA.SUBSCRIPTIONS,
      );
      if (subscriptionData.nextPageToken !== undefined) {
        setItem('nextPageToken', subscriptionData.nextPageToken);
      }
      const fetchedUserdata = await checkUserdata(
        `/sharetubes/count?user=${userData.id}`,
      );
      const isInitialUse = fetchedUserdata ? false : true;
      const nextState = {
        ...this.state,
        isInitialUse,
        isAuthorized: true,
        userProfile: {
          ...userData,
        },
        subscriptionList: {
          ...subscriptionData,
        },
        sharedList: isInitialUse
          ? {
              nickname: userData.nickname,
              items: [],
            }
          : trim(await fetchShared(`/sharetubes/${userData.id}`), DATA.SHARED),
      };

      this.setState(nextState, 'userPage');
    } else if (userId) {
      const sharedData = trim(
        await fetchShared(`/sharetubes/${userId}`),
        DATA.SHARED,
      );
      const nextState = {
        ...this.state,
        sharedList: {
          ...sharedData,
        },
      };

      this.setState(nextState, 'sharePage');
    }
  };

  initRouter(() => this.route());

  this.route();
}
