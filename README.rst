Covid-19 simulation viewer
==========================

Prerequisites
-------------

* Python 3.7
* pipenv
* Node
* npm


Installation
------------

::

    $ git clone https://github.com/ABI-Covid-19/map-server
    $ git clone https://github.com/ABI-Covid-19/map-viewer
    $ git clone https://github.com/ABI-Covid-19/sim-server

* In ``map-server`` and ``sim-server`` run ``pipenv install``.
* In ``map-viewer`` run ``npm install``.
* Create a symbolic link in ``map-server/src`` called ``celeryapp`` that points to ``sim-server/simulations/celeryapp``.
* Adjust ``DATA_DIR`` in ``sim-server/simulations/transportation/__init__.py`` to point to the directory with simulation output files. The directory's name must start with the same date prefix used for the GeoJSON files (e.g. ``actors_2020_07_05``) and names of files in the directory must be in the format ``actors_YYYY_MM_DD_HH_MM_SS.geojson``.

Running
-------

In three separate terminal windows:

::

    $ cd map-server
    $ pipenv shell
    $ python src/server.py

::

    $ cd map-viewer
    $ npm start

::

    $ cd sim-server
    $ pipenv shell
    $ celery worker --app=simulations.app --loglevel=ERROR -E

* Point a web browser at http://localhost:4328/#13.5/-36.69246/174.73992 and click ``START``.
* Hovering over the supermarket (or any other building) while a simulation is playing back will show a summary of the building's occupants.
