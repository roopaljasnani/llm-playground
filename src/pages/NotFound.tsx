import { Link } from 'react-router';

const NotFound: React.FC = () => {
  return (
    <>
      <h1>Page not found</h1>
      <Link to="/">Go home</Link>
    </>
  );
};

export default NotFound;
