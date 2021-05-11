import 'bootstrap/dist/css/bootstrap.min.css';
import { has, uniqueId, differenceBy, find, findIndex } from 'lodash';
import axios from 'axios';
// import axiosRetry from 'axios-retry';
import i18next from 'i18next';
import { setLocale } from 'yup';

import { watchFeeds, watchPosts, watchValidation } from './watchers';
import validate from './validator';
import RSSparser from './RSSparser';
import ru from './locales/ru';

const getData = (url, watchedValidation) => {
  console.log('получение данных...............');
  const proxy = 'https://hexlet-allorigins.herokuapp.com/raw?url=';
  // axiosRetry(axios, { retries: 5, retryDelay: axiosRetry.exponentialDelay });
  return axios
    .get(`${proxy}${url}`, { params: { disableCache: true } })
    .then((data) => {
      console.log('!!!!---- искуственный then -------!!!!');
      return data;
    })
    .catch((e) => {
      console.log('ошибка сети..............');
      watchedValidation.status = ['networkErr'];
      console.error(e);
    });
};

const handleClickPost = (posts, watchedPosts) => {
  const modalHeader = document.querySelector('.modal-title');
  const modalBody = document.querySelector('.modal-body');
  const linkButton = document.querySelector('a.btn');

  const postsButtons = document.querySelectorAll('[data-bs-toggle=modal]');
  postsButtons.forEach((button) => {
    button.addEventListener('click', ({ target }) => {
      const { id } = target;

      const postIndex = findIndex(posts, { id });
      watchedPosts[postIndex].visited = true;
      handleClickPost(posts, watchedPosts);

      const currentPost = find(posts, { id });
      modalHeader.textContent = currentPost.title;
      modalBody.textContent = currentPost.descript;
      linkButton.setAttribute('href', currentPost.link);
    });
  });

  const postsLinks = document.querySelectorAll('[data-id]');
  postsLinks.forEach((postLink) => {
    postLink.addEventListener('click', ({ target }) => {
      const id = target.getAttribute('data-id');
      const postIndex = findIndex(posts, { id });
      watchedPosts[postIndex].visited = true;
      handleClickPost(posts, watchedPosts);
    });
  });
};

export default () => {
  i18next.init({
    lng: 'ru',
    debug: true,
    resources: {
      ru,
    },
  });

  setLocale({
    mixed: {
      default: 'validationError',
      notOneOf: 'duplicateURL',
    },
    string: {
      url: 'invalidURL',
    },
  });

  const state = {
    urls: [],
    feeds: [],
    chanalPosts: [],
    linkValidation: {},
  };

  const watchedFeeds = watchFeeds(state.feeds);
  const watchedPosts = watchPosts(state.chanalPosts);
  const watchedValidation = watchValidation(state.linkValidation);

  const form = document.querySelector('form');
  const input = document.querySelector('input');
  const submitButt = document.querySelector('[aria-label=add]');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    input.setAttribute('readonly', true);
    submitButt.setAttribute('disabled', 'disabled');
    console.log('клик по кнопке, state до:', state);
    const formData = new FormData(e.target);
    const url = formData.get('url');
    const validation = validate(url, state.urls);
    console.log('переданный url', url, 'validation:', validation);

    if (has(validation, 'url')) {
      state.urls.push(url);
      console.log('обновленный стейт из if:', state);
      getData(validation.url, watchedValidation)
        .then(({ data }) => {
          console.log('data из промиса:', data);
          const parsedData = RSSparser(data);
          const { title, description /*posts*/ } = parsedData;
          // const postsWithId = posts.map((post) => ({
          //   id: uniqueId(),
          //   ...post,
          // }));
          watchedFeeds.push({ title, description });
          // watchedPosts.push(...postsWithId);
          watchedValidation.status = ['success'];
          console.log('state после:', state);
        })
        .catch((e) => {
          watchedValidation.status = ['invalidRSS'];
          console.error(e);
        })
        .finally(() => {
          input.removeAttribute('readonly');
          submitButt.removeAttribute('disabled');
        });
    } else {
      watchedValidation.status = validation.errorKeys;
      console.log('ошибка валидации');
      input.removeAttribute('readonly');
      submitButt.removeAttribute('disabled');
    }

    const postUpdater = (url) => {
      getData(url, watchedValidation)
        .then(({ data }) => {
          const { posts } = RSSparser(data);
          return posts;
        })
        .then((posts) => {
          const prewPosts = state.chanalPosts;
          const newPosts = differenceBy(posts, prewPosts, 'title');
          const newPostsWithId = newPosts.map((post) => ({
            id: uniqueId(),
            visited: false,
            ...post,
          }));
          watchedPosts.push(...newPostsWithId);
          handleClickPost(state.chanalPosts, watchedPosts);
        })
        .finally(() => setTimeout(() => postUpdater(url), 5000));
    };

    state.urls.forEach(postUpdater);
  });
};
