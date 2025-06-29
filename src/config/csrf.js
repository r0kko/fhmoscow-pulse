import lusca from 'lusca';

const csrfOptions = {
  angular: true,
  cookie: {
    options: {
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
      secure: process.env.NODE_ENV === 'production',
    },
  },
};

export default lusca.csrf(csrfOptions);
